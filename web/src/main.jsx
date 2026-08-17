import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./styles.css";

const API = "";

const IGNORE = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".venv/",
  "venv/",
  "__pycache__/"
];

const MAX_FILES = 80;
const MAX_FILE_CHARS = 30000;
const MAX_CONTEXT_CHARS = 140000;

function isProbablyText(name, type = "") {
  if (type.startsWith("text/")) return true;

  const lowerName = name.toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase();

  return [
    "js",
    "jsx",
    "ts",
    "tsx",
    "json",
    "html",
    "css",
    "scss",
    "md",
    "txt",
    "yml",
    "yaml",
    "py",
    "java",
    "go",
    "rs",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "php",
    "rb",
    "sh",
    "bash",
    "sql",
    "tf",
    "tfvars",
    "xml",
    "toml",
    "ini",
    "properties",
    "conf",
    "nginx"
  ].includes(ext) || lowerName.includes("dockerfile");
}

function ignored(path) {
  const p = path.replaceAll("\\", "/");
  return IGNORE.some((x) => p.includes(x));
}

async function readEntry(file) {
  const text = await file.text();

  const content = text.slice(0, MAX_FILE_CHARS);

  return {
    path: file.webkitRelativePath || file.name,
    content,
    originalContent: content,
    truncated: text.length > MAX_FILE_CHARS,
    handle: null
  };
}

function languageLabel(language) {
  const map = {
    js: "JavaScript",
    jsx: "JSX",
    ts: "TypeScript",
    tsx: "TSX",
    json: "JSON",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    py: "Python",
    python: "Python",
    java: "Java",
    go: "Go",
    rs: "Rust",
    sh: "Shell",
    bash: "Bash",
    powershell: "PowerShell",
    ps: "PowerShell",
    sql: "SQL",
    yaml: "YAML",
    yml: "YAML",
    dockerfile: "Dockerfile",
    docker: "Docker",
    nginx: "Nginx",
    tf: "Terraform",
    hcl: "HCL",
    xml: "XML",
    md: "Markdown",
    markdown: "Markdown",
    c: "C",
    cpp: "C++",
    cs: "C#"
  };

  return map[language] || language || "Code";
}

function CodeBlock({ inline, className, children }) {
  const language = (className || "")
    .replace("language-", "")
    .trim()
    .toLowerCase();

  const code = String(children).replace(/\n$/, "");

  if (inline) {
    return <code className="inline-code">{children}</code>;
  }

  const [copied, setCopied] = React.useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-language">
          {languageLabel(language)}
        </span>

        <button
          className="copy-code"
          onClick={copyCode}
          type="button"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div className="code-body">
        <SyntaxHighlighter
          language={language || "text"}
          style={vscDarkPlus}
          showLineNumbers
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: "16px",
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.6"
          }}
          lineNumberStyle={{
            minWidth: "3em",
            paddingRight: "14px",
            color: "#666672",
            userSelect: "none"
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}



function cleanSEGAResponse(content) {
  if (!content) return "";

  let text = String(content);

  /*
   * ==========================================================
   * REMOVE AI-GENERATED UI LABELS
   * ==========================================================
   *
   * The SEGA frontend already creates:
   *
   *     Dockerfile                         Copy
   *
   * Gemini must NOT generate those labels itself.
   */

  text = text.replace(
    /^\s*\*\*Code\*\*\s*Copy\s*$/gim,
    ""
  );

  text = text.replace(
    /^\s*\*\*Code\*\*\s*$/gim,
    ""
  );

  text = text.replace(
    /^\s*Code\s+Copy\s*$/gim,
    ""
  );

  text = text.replace(
    /^\s*CodeCopy\s*$/gim,
    ""
  );

  text = text.replace(
    /^\s*\*\*(Dockerfile|Nginx|JavaScript|TypeScript|Python|JSON|YAML|Bash|CSS|HTML|Terraform|Shell)\*\*\s*Copy\s*$/gim,
    ""
  );

  /*
   * ==========================================================
   * REMOVE FILENAME-ONLY CODE BLOCKS
   * ==========================================================
   *
   * This is the important fix.
   *
   * It catches ALL language identifiers:
   *
   * ```text
   * Dockerfile
   * ```
   *
   * ```dockerfile
   * Dockerfile
   * ```
   *
   * ```nginx
   * nginx.conf
   * ```
   *
   * ```javascript
   * main.jsx
   * ```
   *
   * etc.
   */

  const filenameOnlyPattern =
    /```[^\n]*\n\s*([A-Za-z0-9_.-]+)\s*\n```/gim;

  text = text.replace(
    filenameOnlyPattern,
    (match, filename) => {

      const knownFile =
        /^(Dockerfile|dockerfile|nginx\.conf|package\.json|package-lock\.json|package-lock\.yaml|index\.html|main\.jsx|App\.jsx|App\.tsx|main\.tsx|styles\.css|\.env|\.gitignore|vite\.config\.(js|ts)|tsconfig\.json|README\.md)$/i;

      /*
       * Only remove it if the content is clearly a filename.
       */
      if (knownFile.test(filename.trim())) {
        return "";
      }

      return match;
    }
  );

  /*
   * ==========================================================
   * REMOVE EMPTY FENCES
   * ==========================================================
   */

  text = text.replace(
    /```[^\n]*\n\s*```/g,
    ""
  );

  /*
   * ==========================================================
   * REMOVE DUPLICATE FILE LABELS
   * ==========================================================
   *
   * Example:
   *
   * **Dockerfile**
   *
   * ### Dockerfile
   *
   * We keep the proper Markdown heading.
   */

  text = text.replace(
    /^\s*\*\*(Dockerfile|nginx\.conf|package\.json|main\.jsx|styles\.css)\*\*\s*$/gim,
    ""
  );

  /*
   * ==========================================================
   * CLEAN EXCESSIVE BLANK LINES
   * ==========================================================
   */

  text = text.replace(
    /\n{4,}/g,
    "\n\n"
  );

  return text.trim();
}

function MarkdownMessage({ content }) {
  const cleanedContent = cleanSEGAResponse(content);

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,

          pre: ({ children }) => (
            <>{children}</>
          ),

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          )
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
}

function createDiff(original, updated) {
  const oldLines = String(original || "").split(/\r?\n/);
  const newLines = String(updated || "").split(/\r?\n/);

  const diff = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];

    if (oldLine === newLine) {
      diff.push({
        type: "same",
        text: oldLine ?? ""
      });

      i++;
      j++;
      continue;
    }

    if (
      i + 1 < oldLines.length &&
      oldLines[i + 1] === newLine
    ) {
      diff.push({
        type: "removed",
        text: oldLine ?? ""
      });

      i++;
      continue;
    }

    if (
      j + 1 < newLines.length &&
      oldLine === newLines[j + 1]
    ) {
      diff.push({
        type: "added",
        text: newLine ?? ""
      });

      j++;
      continue;
    }

    if (oldLine !== undefined) {
      diff.push({
        type: "removed",
        text: oldLine
      });

      i++;
    }

    if (newLine !== undefined) {
      diff.push({
        type: "added",
        text: newLine
      });

      j++;
    }
  }

  return diff;
}

function searchFiles(files, query) {
  const q = query.trim().toLowerCase();

  if (!q) return [];

  const results = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);

    if (file.path.toLowerCase().includes(q)) {
      results.push({
        path: file.path,
        line: 1,
        text: lines[0]?.slice(0, 180) || file.path
      });
    }

    lines.forEach((line, index) => {
      if (results.length >= 60) return;

      if (line.toLowerCase().includes(q)) {
        results.push({
          path: file.path,
          line: index + 1,
          text: line.trim().slice(0, 240)
        });
      }
    });

    if (results.length >= 60) break;
  }

  return results;
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I'm SEGA. Open a project and I can reason about its files, architecture, errors, and code. Your project files stay in your browser unless you send them in a chat request."
    }
  ]);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [files, setFiles] = useState([]);
  const [projectName, setProjectName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState([]);

  const [editRequest, setEditRequest] = useState(null);
  const [editText, setEditText] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [editApplied, setEditApplied] = useState(false);

  const [showWorkspaceChanges, setShowWorkspaceChanges] = useState(false);
  const [selectedWorkspaceChange, setSelectedWorkspaceChange] = useState(null);

  const [gitStatus, setGitStatus] = useState(null);
  const [gitDiff, setGitDiff] = useState("");
  const [gitBusy, setGitBusy] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);

  const folderInput = useRef(null);

  const tree = useMemo(
    () => files.map((f) => f.path).slice(0, 80),
    [files]
  );

  const searchResults = useMemo(
    () => searchFiles(files, searchQuery),
    [files, searchQuery]
  );

  const workspaceChanges = useMemo(
    () =>
      files.filter(
        (file) =>
          typeof file.originalContent === "string" &&
          file.content !== file.originalContent
      ),
    [files]
  );

  /*
   * Fallback folder picker.
   * This method is READ-ONLY because the browser only gives us File objects.
   */
  async function openFiles(fileList) {
    const selected = Array.from(fileList || [])
      .filter((f) => isProbablyText(f.name, f.type))
      .filter((f) =>
        !ignored(f.webkitRelativePath || f.name)
      )
      .slice(0, MAX_FILES);

    const loaded = [];

    for (const file of selected) {
      try {
        loaded.push(await readEntry(file));
      } catch {
        // Ignore unreadable files.
      }
    }

    setFiles(loaded);

    if (loaded.length) {
      setProjectName(
        loaded[0].path.split("/")[0] || "Workspace"
      );
    }

    setEditStatus(
      "Project opened in read-only fallback mode. Use Chrome or Edge for Safe Edit."
    );
  }

  /*
   * IMPORTANT:
   * This is the ONLY openProject function.
   *
   * It requests read/write access using the File System Access API.
   */
  async function openProject() {
    if (!window.showDirectoryPicker) {
      folderInput.current?.click();
      return;
    }

    try {
      const dirHandle =
        await window.showDirectoryPicker({
          mode: "readwrite"
        });

      const loaded = [];

      await readDirectoryHandle(
        dirHandle,
        "",
        loaded
      );

      setFiles(loaded.slice(0, MAX_FILES));

      setProjectName(
        dirHandle.name || "Workspace"
      );

      setSearchQuery("");
      setSearchOpen(false);
      setSelectedSearch([]);

      setEditStatus(
        `Opened ${dirHandle.name} with read/write permission.`
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        setEditStatus(
          `Could not open project: ${err.message}`
        );
      }
    }
  }

  /*
   * Recursively reads the project directory.
   *
   * The important part is:
   *
   * handle: entry
   *
   * That FileSystemFileHandle is later used by Apply Change.
   */
  async function readDirectoryHandle(
    dirHandle,
    prefix,
    loaded
  ) {
    for await (const entry of dirHandle.values()) {
      const path = prefix
        ? `${prefix}/${entry.name}`
        : entry.name;

      if (ignored(path)) continue;

      if (entry.kind === "directory") {
        if (
          [
            "node_modules",
            ".git",
            "dist",
            "build",
            ".next",
            "coverage"
          ].includes(entry.name)
        ) {
          continue;
        }

        await readDirectoryHandle(
          entry,
          path,
          loaded
        );

        if (loaded.length >= MAX_FILES) {
          return;
        }
      }

      if (
        entry.kind === "file" &&
        isProbablyText(entry.name)
      ) {
        try {
          const file = await entry.getFile();

          if (
            file.size >
            MAX_FILE_CHARS * 2
          ) {
            continue;
          }

          const text = await file.text();

          const content = text.slice(
            0,
            MAX_FILE_CHARS
          );

          loaded.push({
            path,
            content,
            originalContent: content,
            truncated:
              text.length > MAX_FILE_CHARS,

            // KEEP THE WRITABLE HANDLE
            handle: entry
          });
        } catch {
          // Ignore unreadable files.
        }
      }

      if (loaded.length >= MAX_FILES) {
        return;
      }
    }
  }

  async function checkLocalAgent() {
    try {
      const response = await fetch(
        "http://127.0.0.1:8787/health"
      );

      if (!response.ok) {
        throw new Error("Local Agent is not running.");
      }

      return true;
    } catch {
      setGitStatus({
        connected: false,
        error:
          "Local Agent is not running. Start it from your project folder."
      });

      return false;
    }
  }

  async function loadGitStatus() {
    setGitBusy(true);
    setGitPanelOpen(true);

    try {
      const connected = await checkLocalAgent();

      if (!connected) return;

      const response = await fetch(
        "http://127.0.0.1:8787/git/status"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Could not read Git status."
        );
      }

      setGitStatus({
        ...data,
        connected: true
      });
    } catch (error) {
      setGitStatus({
        connected: false,
        error:
          error?.message ||
          "Could not connect to the Local Agent."
      });
    } finally {
      setGitBusy(false);
    }
  }

  async function loadGitDiff() {
    setGitBusy(true);

    try {
      const connected = await checkLocalAgent();

      if (!connected) return;

      const response = await fetch(
        "http://127.0.0.1:8787/git/diff"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Could not read Git diff."
        );
      }

      setGitDiff(data.diff || "");
      setGitPanelOpen(true);
    } catch (error) {
      setGitStatus((current) => ({
        ...(current || {}),
        connected: false,
        error:
          error?.message ||
          "Could not load Git diff."
      }));
    } finally {
      setGitBusy(false);
    }
  }

  function clearProject() {
    setFiles([]);
    setProjectName("");
    setSearchQuery("");
    setSearchOpen(false);
    setSelectedSearch([]);
    setEditRequest(null);
    setEditText("");
    setEditStatus("");
    setEditApplied(false);
    setShowWorkspaceChanges(false);
    setSelectedWorkspaceChange(null);
    setGitStatus(null);
    setGitDiff("");
    setGitPanelOpen(false);
  }

  /*
   * Create an editing request.
   *
   * The important part is:
   *
   * handle: file.handle
   *
   * This fixes the previous read-only problem.
   */
 async function generateAIEdit() {
  let request = editRequest;

  /*
   * If no edit request exists yet, automatically
   * create one from the selected search result.
   */
  if (!request) {
    const selectedPath = selectedSearch[0]?.path;

    if (!selectedPath) {
      setEditStatus(
        "Select a file from Search project first."
      );
      return;
    }

    const file = files.find(
      (f) => f.path === selectedPath
    );

    if (!file) {
      setEditStatus(
        "Selected file could not be found."
      );
      return;
    }

    if (!file.handle) {
      setEditStatus(
        "This file is read-only. Re-open the project with Chrome or Edge using Open project."
      );
      return;
    }

    request = {
      path: file.path,
      original: file.content,
      handle: file.handle
    };

    setEditRequest(request);
    setEditText(file.content);
  }

  if (!editPrompt.trim()) {
    setEditStatus(
      "Describe what you want SEGA to change."
    );
    return;
  }

  setEditBusy(true);
  setEditStatus(
    `SEGA is modifying ${request.path}...`
  );

  try {
    const prompt = `
You are modifying an existing project file.

FILE PATH:
${request.path}

CURRENT FILE:
---BEGIN FILE---
${request.original}
---END FILE---

USER REQUEST:
${editPrompt}

TASK:
Modify the current file according to the user's request.

STRICT OUTPUT RULES:

1. Return ONLY the complete modified file.
2. Return the entire file.
3. Do NOT explain anything.
4. Do NOT add a filename heading.
5. Do NOT write "Copy".
6. Do NOT use Markdown.
7. Do NOT use triple backticks.
8. Preserve everything that does not need to change.
9. Make only the changes required by the user's request.
`;

    const response = await fetch(
      "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          workspace: [
            {
              path: request.path,
              content: request.original
            }
          ]
        })
      }
    );

    const rawResponse =
      await response.text();

    let data;

   try {
  data = JSON.parse(
    rawResponse
  );
} catch {
  throw new Error(
    `Server returned invalid JSON (HTTP ${response.status}).`
  );
}

if (!response.ok) {
  throw new Error(
    data?.error ||
    `SEGA request failed with HTTP ${response.status}.`
  );
}


    let proposed = String(
      data?.text || ""
    ).trim();

    if (!proposed) {
      throw new Error(
        "SEGA returned an empty edit."
      );
    }

    /*
     * Remove Markdown code fences if Gemini
     * accidentally returns them.
     */
    const fencedMatch =
      proposed.match(
        /^```[^\n]*\n([\s\S]*?)\n```$/
      );

    if (fencedMatch) {
      proposed =
        fencedMatch[1].trim();
    }

    /*
     * Remove accidental filename heading.
     */
    const fileName =
      request.path
        .split("/")
        .pop();

    const escapedFileName =
      fileName.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const headingPattern =
      new RegExp(
        `^(?:#{1,6}\\s*|\\*\\*)${escapedFileName}(?:\\*\\*)?\\s*\\n+`,
        "i"
      );

    proposed = proposed
      .replace(
        headingPattern,
        ""
      )
      .trim();

    if (!proposed) {
      throw new Error(
        "SEGA generated an empty file."
      );
    }

    /*
     * Put the generated code into the editor.
     */
    setEditText(proposed);

    setEditStatus(
      `✓ Edit generated for ${request.path}. Review it before applying.`
    );

  } catch (error) {
    console.error(
      "SEGA Generate Edit error:",
      error
    );

    setEditStatus(
      `SEGA error: ${
        error?.message ||
        "Could not generate the edit."
      }`
    );

  } finally {
    setEditBusy(false);
  }
}

async function applyAIEdit() {
  if (!editRequest || !editText.trim()) {
    setEditStatus("No generated edit is available.");
    return;
  }

  const handle = editRequest.handle;

  if (!handle) {
    setEditStatus(
      "This file has no writable handle. Re-open the project with Chrome or Edge using Open project."
    );
    return;
  }

  setEditBusy(true);
  setEditStatus("Saving changes to the local file...");

  try {
    let permission = "granted";

    if (typeof handle.queryPermission === "function") {
      permission = await handle.queryPermission({
        mode: "readwrite"
      });
    }

    if (permission !== "granted") {
      if (typeof handle.requestPermission !== "function") {
        throw new Error(
          "Write permission is not available for this file."
        );
      }

      permission = await handle.requestPermission({
        mode: "readwrite"
      });
    }

    if (permission !== "granted") {
      throw new Error(
        "Write permission was denied. Allow file access and try again."
      );
    }

    const writable = await handle.createWritable();

    try {
      await writable.write(editText);
    } finally {
      await writable.close();
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.path === editRequest.path
          ? {
              ...file,
              content: editText,
              truncated: false
            }
          : file
      )
    );

    setEditApplied(true);
    setEditStatus(
      `✓ Saved changes to ${editRequest.path}`
    );
  } catch (error) {
    console.error("SEGA file save error:", error);
    setEditStatus(
      error?.message ||
      "SEGA could not save the file."
    );
  } finally {
    setEditBusy(false);
  }
}

async function undoAIEdit() {
  if (!editRequest) {
    setEditStatus("Nothing to undo.");
    return;
  }

  const originalContent = editRequest.original;
  const handle = editRequest.handle;
  const wasApplied = editApplied;

  setEditBusy(true);
  setEditStatus(
    wasApplied
      ? "Restoring the original file..."
      : "Reverting the browser workspace..."
  );

  try {
    if (wasApplied) {
      if (!handle) {
        throw new Error(
          "The writable file handle is no longer available."
        );
      }

      let permission = "granted";

      if (typeof handle.queryPermission === "function") {
        permission = await handle.queryPermission({
          mode: "readwrite"
        });
      }

      if (permission !== "granted") {
        if (typeof handle.requestPermission !== "function") {
          throw new Error(
            "Write permission is not available for this file."
          );
        }

        permission = await handle.requestPermission({
          mode: "readwrite"
        });
      }

      if (permission !== "granted") {
        throw new Error(
          "Write permission was denied. Allow file access and try again."
        );
      }

      const writable = await handle.createWritable();

      try {
        await writable.write(originalContent);
      } finally {
        await writable.close();
      }
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.path === editRequest.path
          ? {
              ...file,
              content: originalContent
            }
          : file
      )
    );

    setEditText(originalContent);
    setEditApplied(false);
    setEditStatus(
      wasApplied
        ? `↶ Restored ${editRequest.path} to the original file.`
        : "↶ Changes reverted."
    );
  } catch (error) {
    console.error("SEGA undo error:", error);
    setEditStatus(
      error?.message ||
      "SEGA could not restore the file."
    );
  } finally {
    setEditBusy(false);
  }
}

  function proposeEdit() {
    const path = selectedSearch[0]?.path;

    const file = files.find(
      (f) => f.path === path
    );

    if (!file) {
      setEditStatus(
        "Select a file from Search project first."
      );
      return;
    }

    if (!file.handle) {
      setEditStatus(
        "This file was opened read-only. Close the project and reopen it with Chrome/Edge using Open project."
      );
      return;
    }

    setEditRequest({
      path: file.path,
      original: file.content,

      // KEEP THE WRITABLE HANDLE
      handle: file.handle
    });

    setEditApplied(false);
    setEditText(file.content);
    setEditPrompt("");
    setEditStatus("");

    setEditStatus(
      "Review the proposed file before applying it."
    );
  }

  async function send() {
    const text = input.trim();

    if (!text || busy) return;

    const next = [
      ...messages,
      {
        role: "user",
        content: text
      }
    ];

    setMessages(next);
    setInput("");
    setBusy(true);

    const workspace = [];

    let remaining =
      MAX_CONTEXT_CHARS;

    const sourceFiles =
      selectedSearch.length
        ? files.filter((f) =>
            selectedSearch.some(
              (r) => r.path === f.path
            )
          )
        : files;

    for (const file of sourceFiles) {
      if (remaining <= 0) break;

      const content =
        file.content.slice(
          0,
          remaining
        );

      workspace.push({
        path: file.path,
        content,
        truncated:
          file.truncated ||
          content.length <
            file.content.length
      });

      remaining -= content.length;
    }

    try {
      const res = await fetch(
        `${API}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            messages: next,
            workspace
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Request failed"
        );
      }

      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.text
        }
      ]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            `SEGA error: ${err.message}`
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="app">

      <aside className="sidebar">

        <div className="brand">
          SEGA<span> AI</span>
        </div>

        <button
          className="new-chat"
          onClick={() =>
            setMessages([])
          }
        >
          + New chat
        </button>

        <button
          className="project-button"
          onClick={openProject}
        >
          📁 Open project
        </button>

        <button
          className={`search-project ${
            !files.length
              ? "disabled"
              : ""
          }`}
          onClick={() =>
            files.length &&
            setSearchOpen(
              (v) => !v
            )
          }
          disabled={!files.length}
        >
          🔎 Search project
        </button>

        <button
          className={`workspace-changes-button ${
            !files.length
              ? "disabled"
              : ""
          }`}
          onClick={() =>
            files.length &&
            setShowWorkspaceChanges(
              (value) => !value
            )
          }
          disabled={!files.length}
        >
          {workspaceChanges.length > 0
            ? `↕ Workspace Changes (${workspaceChanges.length})`
            : "↕ Workspace Changes"}
        </button>

        <button
          className="git-button"
          type="button"
          onClick={loadGitStatus}
          disabled={gitBusy}
        >
          {gitBusy
            ? "⟳ Git..."
            : "⌘ Git status"}
        </button>

        {gitPanelOpen && (
          <div className="git-panel">
            <div className="git-panel-header">
              <div>
                <strong>Local Git</strong>
                <span>
                  {gitStatus?.connected
                    ? "Connected"
                    : "Not connected"}
                </span>
              </div>

              <button
                type="button"
                className="git-close-button"
                onClick={() =>
                  setGitPanelOpen(false)
                }
              >
                ×
              </button>
            </div>

            {gitStatus?.error ? (
              <div className="git-error">
                {gitStatus.error}
              </div>
            ) : gitStatus?.connected ? (
              <>
                <div className="git-repo-info">
                  <strong>
                    {gitStatus.branch || "Git repository"}
                  </strong>
                  <span>
                    {gitStatus.clean
                      ? "Working tree clean"
                      : `${gitStatus.files?.length || 0} changed file(s)`}
                  </span>
                </div>

                <div className="git-actions">
                  <button
                    type="button"
                    onClick={loadGitStatus}
                    disabled={gitBusy}
                  >
                    ↻ Refresh
                  </button>

                  <button
                    type="button"
                    onClick={loadGitDiff}
                    disabled={gitBusy}
                  >
                    View Git Diff
                  </button>
                </div>

                {!gitStatus.clean &&
                  Array.isArray(gitStatus.files) && (
                    <div className="git-file-list">
                      {gitStatus.files.map(
                        (file, index) => (
                          <div
                            className="git-file-row"
                            key={`${file.path}-${index}`}
                          >
                            <span className="git-file-code">
                              {file.code || "M"}
                            </span>

                            <span>
                              {file.path}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                {gitDiff && (
                  <pre className="git-diff-output">
                    {gitDiff}
                  </pre>
                )}
              </>
            ) : (
              <div className="git-empty">
                Click Git status to connect to the Local Agent.
              </div>
            )}
          </div>
        )}

        {searchOpen &&
          files.length > 0 && (
            <div className="search-panel">

              <input
                autoFocus
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                placeholder="Search code or filename..."
              />

              <div className="search-meta">
                {searchQuery
                  ? `${searchResults.length} matches`
                  : "Type to search"}
              </div>

              <div className="search-results">

                {searchResults.map(
                  (r, i) => (
                    <button
                      key={`${r.path}:${r.line}:${i}`}
                      className="search-result"
                      onClick={() =>
                        setSelectedSearch(
                          (prev) =>
                            prev.some(
                              (x) =>
                                x.path ===
                                r.path
                            )
                              ? prev
                              : [
                                  ...prev,
                                  r
                                ]
                        )
                      }
                    >
                      <strong>
                        {r.path}
                      </strong>

                      <span>
                        Line {r.line}
                      </span>

                      <code>
                        {r.text}
                      </code>
                    </button>
                  )
                )}

                {searchQuery &&
                  !searchResults.length && (
                    <div className="no-results">
                      No matches found.
                    </div>
                  )}

              </div>

              {selectedSearch.length >
                0 && (
                <div className="selected-search">

                  <div className="selected-title">
                    Selected context
                  </div>

                  {selectedSearch.map(
                    (r) => (
                      <button
                        key={r.path}
                        onClick={() =>
                          setSelectedSearch(
                            (prev) =>
                              prev.filter(
                                (x) =>
                                  x.path !==
                                  r.path
                              )
                          )
                        }
                      >
                        {r.path} ×
                      </button>
                    )
                  )}

                  <button
                    className="edit-selected"
                    onClick={
                      proposeEdit
                    }
                  >
                    ✏️ Propose edit for selected file
                  </button>

                </div>
              )}

            </div>
          )}

        <input
          ref={folderInput}
          type="file"
          hidden
          multiple
          webkitdirectory=""
          directory=""
          onChange={(e) =>
            openFiles(
              e.target.files
            )
          }
        />

        {showWorkspaceChanges && files.length > 0 && (
          <div className="workspace-changes-panel">
            <div className="workspace-changes-header">
              <strong>Workspace Changes</strong>
              <span>
                {workspaceChanges.length
                  ? `${workspaceChanges.length} modified`
                  : "No changes"}
              </span>
            </div>

            {workspaceChanges.length > 0 ? (
              <div className="workspace-changes-list">
                {workspaceChanges.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className="workspace-change-item"
                    onClick={() =>
                      setSelectedWorkspaceChange(file)
                    }
                  >
                    <span className="workspace-change-icon">
                      M
                    </span>
                    <span className="workspace-change-path">
                      {file.path}
                    </span>
                    <span className="workspace-change-arrow">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="workspace-changes-empty">
                No unsaved workspace changes.
              </div>
            )}
          </div>
        )}

        <div className="nav">
          <div>⌘ Projects</div>
          <div>◈ Agents</div>
          <div>⚡ Skills</div>
          <div>◌ Integrations</div>
        </div>

        <div className="workspace">

          <div className="workspace-title">

            <strong>
              {projectName ||
                "No workspace"}
            </strong>

            {files.length > 0 && (
              <button
                onClick={
                  clearProject
                }
                title="Close project"
              >
                ×
              </button>
            )}

          </div>

          {files.length > 0 ? (
            <>
              <div className="file-count">
                {files.length} text files indexed
              </div>

              <div className="file-tree">
                {tree.map(
                  (path) => (
                    <div key={path}>
                      📄 {path}
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <p className="workspace-help">
              Open a local project
              folder. SEGA will
              index supported text
              files in your browser
              and include relevant
              project context in chat.
            </p>
          )}

        </div>

        <div className="side-note">

          <strong>
            Agent roadmap
          </strong>

          <p>
            Workspace context →
            code search → safe edits
            → tests → Git → isolated
            command execution →
            subagents.
          </p>

        </div>

      </aside>

      <main className="main">

        <header>

          <div>
            <h1>SEGA</h1>
            <p>
              Agentic coding assistant
            </p>
          </div>

          <span className="status">
            ● Ready
          </span>

        </header>

        <section className="chat">

          {messages.length === 0 && (
            <div className="empty">

              <div className="logo">
                S
              </div>

              <h2>
                Build with SEGA
              </h2>

              <p>
                Open a project,
                inspect its code,
                debug errors, and ask
                SEGA about the
                architecture.
              </p>

            </div>
          )}

          {messages.map(
            (m, i) => (
              <article
                key={i}
                className={`message ${m.role}`}
              >

                <div className="avatar">
                  {m.role ===
                  "assistant"
                    ? "S"
                    : "U"}
                </div>

                <div className="bubble">

                  <div className="role">
                    {m.role ===
                    "assistant"
                      ? "SEGA"
                      : "You"}
                  </div>

                  <MarkdownMessage
                    content={
                      m.content
                    }
                  />

                </div>

              </article>
            )
          )}

          {busy && (
            <article className="message assistant">

              <div className="avatar">
                S
              </div>

              <div className="bubble">

                <div className="role">
                  SEGA
                </div>

                <div className="thinking">
                  Thinking…
                </div>

              </div>

            </article>
          )}

        </section>

        <div className="composer">

          {selectedSearch.length >
            0 && (
            <div className="context-strip">
              🔎 Using{" "}
              {selectedSearch.length}{" "}
              selected file
              {selectedSearch.length >
              1
                ? "s"
                : ""}{" "}
              as context
            </div>
          )}
<div className="edit-request-box">
  <label className="edit-request-label">
    What should SEGA change?
  </label>

  <textarea
    className="edit-request-input"
    value={editPrompt}
    onChange={(e) => setEditPrompt(e.target.value)}
    placeholder="Example: Change Node 20 to Node 22 and use npm ci."
    rows={3}
    disabled={editBusy}
  />

  <button
    className="edit-generate-button"
    onClick={generateAIEdit}
    disabled={editBusy || !editPrompt.trim()}
    type="button"
  >
    {editBusy ? "SEGA is thinking..." : "Generate Edit"}
  </button>
</div>
          
          <textarea
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            onKeyDown={onKeyDown}
            placeholder={
              files.length
                ? `Ask SEGA about ${
                    projectName ||
                    "your project"
                  }…`
                : "Ask SEGA to build, debug, review, or explain something…"
            }
            rows={3}
          />

          <div className="composer-bottom">

            <span>
              {files.length
                ? `${files.length} files in workspace · Enter to send`
                : "Enter to send · Shift+Enter for a new line"}
            </span>

            <button
              onClick={send}
              disabled={
                busy ||
                !input.trim()
              }
            >
              {busy
                ? "Working…"
                : "Send ↑"}
            </button>

          </div>

        </div>

       {selectedWorkspaceChange && (
  <div className="edit-overlay workspace-change-overlay">
    <div className="edit-modal workspace-change-modal">
      <div className="edit-modal-header">
        <div>
          <strong>Workspace change</strong>
          <span>{selectedWorkspaceChange.path}</span>
        </div>

        <button
          type="button"
          onClick={() =>
            setSelectedWorkspaceChange(null)
          }
        >
          ×
        </button>
      </div>

      <p className="edit-warning">
        This is the difference between the file when the
        project was opened and its current browser workspace content.
      </p>

      <div className="workspace-change-diff">
        <div className="diff-viewer-header">
          <div>
            <strong>Changes</strong>
            <span>Original vs current workspace</span>
          </div>
        </div>

        <div className="diff-summary">
          {(() => {
            const diff = createDiff(
              selectedWorkspaceChange.originalContent,
              selectedWorkspaceChange.content
            );

            const added = diff.filter(
              (item) => item.type === "added"
            ).length;

            const removed = diff.filter(
              (item) => item.type === "removed"
            ).length;

            return (
              <>
                <span className="diff-added-count">
                  +{added} added
                </span>
                <span className="diff-removed-count">
                  −{removed} removed
                </span>
              </>
            );
          })()}
        </div>

        <div className="diff-columns">
          <div className="diff-column">
            <div className="diff-column-title original">
              Original
            </div>

            <div className="diff-code">
              {createDiff(
                selectedWorkspaceChange.originalContent,
                selectedWorkspaceChange.content
              ).map((item, index) => (
                <div
                  key={`workspace-old-${index}`}
                  className={`diff-line diff-line-${item.type}`}
                >
                  <span className="diff-prefix">
                    {item.type === "removed" ? "−" : " "}
                  </span>
                  <code>
                    {item.type === "added"
                      ? ""
                      : item.text}
                  </code>
                </div>
              ))}
            </div>
          </div>

          <div className="diff-column">
            <div className="diff-column-title proposed">
              Current
            </div>

            <div className="diff-code">
              {createDiff(
                selectedWorkspaceChange.originalContent,
                selectedWorkspaceChange.content
              ).map((item, index) => (
                <div
                  key={`workspace-new-${index}`}
                  className={`diff-line diff-line-${item.type}`}
                >
                  <span className="diff-prefix">
                    {item.type === "added" ? "+" : " "}
                  </span>
                  <code>
                    {item.type === "removed"
                      ? ""
                      : item.text}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="edit-actions">
        <button
          type="button"
          className="edit-cancel-button"
          onClick={() =>
            setSelectedWorkspaceChange(null)
          }
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

{editRequest && (
  <div className="edit-overlay">

    <div className="edit-modal">

      <div className="edit-modal-header">

        <div>
          <strong>
            SEGA wants to modify
          </strong>

          <span>
            {editRequest.path}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditRequest(null);
            setEditText("");
            setEditStatus("");
            setShowDiff(false);
            setEditApplied(false);
          }}
        >
          ×
        </button>

      </div>

      <p className="edit-warning">
        Review the complete file below. Nothing is
        written until you click Apply Change.
      </p>

      <textarea
        className="edit-textarea"
        value={editText}
        onChange={(e) =>
          setEditText(e.target.value)
        }
        spellCheck={false}
      />

      {showDiff && (
        <div className="diff-viewer">
          <div className="diff-viewer-header">
            <div>
              <strong>Changes</strong>
              <span>Original vs proposed</span>
            </div>
            <span className="diff-file-name">
              {editRequest.path}
            </span>
          </div>

          <div className="diff-summary">
            {(() => {
              const diff = createDiff(
                editRequest.original,
                editText
              );
              const added = diff.filter(
                (item) => item.type === "added"
              ).length;
              const removed = diff.filter(
                (item) => item.type === "removed"
              ).length;

              return (
                <>
                  <span className="diff-added-count">
                    +{added} added
                  </span>
                  <span className="diff-removed-count">
                    −{removed} removed
                  </span>
                </>
              );
            })()}
          </div>

          <div className="diff-columns">
            <div className="diff-column">
              <div className="diff-column-title original">
                <span>Original</span>
              </div>

              <div className="diff-code">
                {createDiff(
                  editRequest.original,
                  editText
                ).map((item, index) => (
                  <div
                    key={`old-${index}`}
                    className={`diff-line diff-line-${item.type}`}
                  >
                    <span className="diff-prefix">
                      {item.type === "removed" ? "−" : " "}
                    </span>
                    <code>
                      {item.type === "added"
                        ? ""
                        : item.text}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            <div className="diff-column">
              <div className="diff-column-title proposed">
                <span>Proposed</span>
              </div>

              <div className="diff-code">
                {createDiff(
                  editRequest.original,
                  editText
                ).map((item, index) => (
                  <div
                    key={`new-${index}`}
                    className={`diff-line diff-line-${item.type}`}
                  >
                    <span className="diff-prefix">
                      {item.type === "added" ? "+" : " "}
                    </span>
                    <code>
                      {item.type === "removed"
                        ? ""
                        : item.text}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="edit-actions">

        <button
          type="button"
          className="edit-diff-button"
          onClick={() =>
            setShowDiff((value) => !value)
          }
          disabled={!editText.trim()}
        >
          {showDiff ? "Hide Diff" : "View Diff"}
        </button>

        <button
          type="button"
          className="edit-apply-button"
          onClick={applyAIEdit}
          disabled={
            editBusy ||
            !editText.trim()
          }
        >
          {editBusy
            ? "Saving..."
            : editApplied
              ? "✓ Saved"
              : "✓ Apply Change"}
        </button>

        <button
          type="button"
          className="edit-undo-button"
          onClick={undoAIEdit}
          disabled={
            editBusy ||
            !editText.trim()
          }
        >
          {editApplied
            ? "↶ Restore Original"
            : "↶ Undo"}
        </button>

        <button
          type="button"
          className="edit-cancel-button"
          onClick={() => {
            setEditRequest(null);
            setEditText("");
            setEditStatus("");
            setShowDiff(false);
            setEditApplied(false);
          }}
        >
          Cancel
        </button>

      </div>

      {editStatus && (
        <div className="edit-status">
          {editStatus}
        </div>
      )}

    </div>

  </div>
)}
</main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <App />
);
