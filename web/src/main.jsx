import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./styles.css";

const API = "";

const IGNORE = [
  "node_modules/", ".git/", "dist/", "build/", ".next/",
  "coverage/", ".venv/", "venv/", "__pycache__/"
];

const MAX_FILES = 80;
const MAX_FILE_CHARS = 30000;
const MAX_CONTEXT_CHARS = 140000;

function isProbablyText(name, type = "") {
  if (type.startsWith("text/")) return true;
  const ext = name.split(".").pop()?.toLowerCase();
  return [
    "js","jsx","ts","tsx","json","html","css","scss","md","txt","yml","yaml",
    "py","java","go","rs","c","cpp","h","hpp","cs","php","rb","sh","bash",
    "sql","tf","tfvars","xml","toml","ini","env.example","properties",
    "dockerfile","conf","nginx"
  ].includes(ext) || name.toLowerCase().includes("dockerfile");
}

function ignored(path) {
  const p = path.replaceAll("\\", "/");
  return IGNORE.some(x => p.includes(x));
}

async function readEntry(file) {
  const text = await file.text();
  return {
    path: file.webkitRelativePath || file.name,
    content: text.slice(0, MAX_FILE_CHARS),
    truncated: text.length > MAX_FILE_CHARS
  };
}


function languageLabel(language) {
  const map = {
    js: "JavaScript", jsx: "JSX", ts: "TypeScript", tsx: "TSX",
    json: "JSON", html: "HTML", css: "CSS", scss: "SCSS",
    py: "Python", python: "Python", java: "Java", go: "Go",
    rs: "Rust", sh: "Shell", bash: "Bash", powershell: "PowerShell",
    ps: "PowerShell", sql: "SQL", yaml: "YAML", yml: "YAML",
    dockerfile: "Dockerfile", docker: "Docker", nginx: "Nginx",
    tf: "Terraform", hcl: "HCL", xml: "XML", md: "Markdown",
    markdown: "Markdown", c: "C", cpp: "C++", cs: "C#",
  };
  return map[language] || language || "Code";
}

function CodeBlock({ inline, className, children }) {
  const language = (className || "").replace("language-", "").trim();
  const code = String(children).replace(/\n$/, "");

  if (inline) {
    return <code className="inline-code">{children}</code>;
  }

  const [copied, setCopied] = React.useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-language">{languageLabel(language)}</span>
        <button className="copy-code" onClick={copyCode}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-content"><code>{code}</code></pre>
    </div>
  );
}

function MarkdownMessage({ content }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


function searchFiles(files, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    if (file.path.toLowerCase().includes(q)) {
      results.push({ path: file.path, line: 1, text: lines[0]?.slice(0, 180) || file.path });
    }
    lines.forEach((line, index) => {
      if (results.length >= 60) return;
      if (line.toLowerCase().includes(q)) {
        results.push({ path: file.path, line: index + 1, text: line.trim().slice(0, 240) });
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
  const folderInput = useRef(null);

  const tree = useMemo(() => files.map(f => f.path).slice(0, 80), [files]);
  const searchResults = useMemo(() => searchFiles(files, searchQuery), [files, searchQuery]);

  async function openFiles(fileList) {
    const selected = Array.from(fileList || [])
      .filter(f => isProbablyText(f.name, f.type))
      .filter(f => !ignored(f.webkitRelativePath || f.name))
      .slice(0, MAX_FILES);

    const loaded = [];
    for (const file of selected) {
      try { loaded.push(await readEntry(file)); } catch {}
    }
    setFiles(loaded);
    if (loaded.length) setProjectName(loaded[0].path.split("/")[0] || "Workspace");
  }

  async function openProject() {
    if (!window.showDirectoryPicker) {
      folderInput.current?.click();
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      const loaded = [];
      await readDirectoryHandle(dirHandle, "", loaded);

      setFiles(loaded.slice(0, MAX_FILES));
      setProjectName(dirHandle.name || "Workspace");
      setSearchQuery("");
      setSelectedSearch([]);
      setEditStatus(`Opened ${dirHandle.name} with read/write permission.`);
    } catch (err) {
      if (err.name !== "AbortError") {
        setEditStatus(`Could not open project: ${err.message}`);
      }
    }
  }

  async function readDirectoryHandle(dirHandle, prefix, loaded) {
    for await (const entry of dirHandle.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (ignored(path)) continue;

      if (entry.kind === "directory") {
        if (["node_modules", ".git", "dist", "build", ".next", "coverage"].includes(entry.name)) continue;
        await readDirectoryHandle(entry, path, loaded);
        if (loaded.length >= MAX_FILES) return;
      } else if (entry.kind === "file" && isProbablyText(entry.name)) {
        try {
          const file = await entry.getFile();
          if (file.size > MAX_FILE_CHARS * 2) continue;
          const text = await file.text();
          loaded.push({
            path,
            content: text.slice(0, MAX_FILE_CHARS),
            truncated: text.length > MAX_FILE_CHARS,
            handle: entry
          });
        } catch {}
      }
      if (loaded.length >= MAX_FILES) return;
    }
  }

  function openProject() {
    folderInput.current?.click();
  }

  function clearProject() {
    setFiles([]);
    setProjectName("");
    setSearchQuery("");
    setSelectedSearch([]);
  }


  function proposeEdit() {
    const path = selectedSearch[0]?.path;
    const file = files.find(f => f.path === path);
    if (!file) {
      setEditStatus("Select a file from Search project first.");
      return;
    }
    setEditRequest({ path: file.path, original: file.content });
    setEditText(file.content);
    setEditStatus("Review the proposed file contents before applying.");
  }

  async function applyEdit() {
    if (!editRequest) return;
    try {
      const handle = editRequest.handle;
      if (!handle) {
        setEditStatus(
          "This browser session indexed file contents read-only. Re-open the project with the file editor enabled to write changes."
        );
        return;
      }
      const writable = await handle.createWritable();
      await writable.write(editText);
      await writable.close();
      setFiles(prev => prev.map(f =>
        f.path === editRequest.path
          ? { ...f, content: editText, truncated: false }
          : f
      ));
      setEditRequest(null);
      setEditStatus(`Applied changes to ${editRequest.path}.`);
    } catch (err) {
      setEditStatus(`Could not write file: ${err.message}`);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    const workspace = [];
    let remaining = MAX_CONTEXT_CHARS;
    const sourceFiles = selectedSearch.length
      ? files.filter(f => selectedSearch.some(r => r.path === f.path))
      : files;

    for (const file of sourceFiles) {
      if (remaining <= 0) break;
      const content = file.content.slice(0, remaining);
      workspace.push({
        path: file.path,
        content,
        truncated: file.truncated || content.length < file.content.length
      });
      remaining -= content.length;
    }

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          workspace
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages([...next, { role: "assistant", content: data.text }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: "assistant", content: `SEGA error: ${err.message}` }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">SEGA<span> AI</span></div>

        <button className="new-chat" onClick={() => setMessages([])}>
          + New chat
        </button>

        <button className="project-button" onClick={openProject}>
          📁 Open project
        </button>

        <button
          className={`search-project ${!files.length ? "disabled" : ""}`}
          onClick={() => files.length && setSearchOpen(v => !v)}
          disabled={!files.length}
        >
          🔎 Search project
        </button>

        {searchOpen && files.length > 0 && (
          <div className="search-panel">
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search code or filename..."
            />
            <div className="search-meta">
              {searchQuery ? `${searchResults.length} matches` : "Type to search"}
            </div>
            <div className="search-results">
              {searchResults.map((r, i) => (
                <button
                  key={`${r.path}:${r.line}:${i}`}
                  className="search-result"
                  onClick={() => setSelectedSearch(prev =>
                    prev.some(x => x.path === r.path) ? prev : [...prev, r]
                  )}
                >
                  <strong>{r.path}</strong>
                  <span>Line {r.line}</span>
                  <code>{r.text}</code>
                </button>
              ))}
              {searchQuery && !searchResults.length && (
                <div className="no-results">No matches found.</div>
              )}
            </div>
            {selectedSearch.length > 0 && (
              <div className="selected-search">
                <div className="selected-title">Selected context</div>
                {selectedSearch.map(r => (
                  <button
                    key={r.path}
                    onClick={() => setSelectedSearch(prev => prev.filter(x => x.path !== r.path))}
                  >
                    {r.path} ×
                  </button>
                ))}
                <button className="edit-selected" onClick={proposeEdit}>
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
          onChange={e => openFiles(e.target.files)}
        />

        <div className="nav">
          <div>⌘ Projects</div>
          <div>◈ Agents</div>
          <div>⚡ Skills</div>
          <div>◌ Integrations</div>
        </div>

        <div className="workspace">
          <div className="workspace-title">
            <strong>{projectName || "No workspace"}</strong>
            {files.length > 0 && (
              <button onClick={clearProject} title="Close project">×</button>
            )}
          </div>

          {files.length > 0 ? (
            <>
              <div className="file-count">{files.length} text files indexed</div>
              <div className="file-tree">
                {tree.map(path => <div key={path}>📄 {path}</div>)}
              </div>
            </>
          ) : (
            <p className="workspace-help">
              Open a local project folder. SEGA will index supported text files
              in your browser and include relevant project context in chat.
            </p>
          )}
        </div>

        <div className="side-note">
          <strong>Agent roadmap</strong>
          <p>
            Workspace context → code search → safe edits → tests → Git →
            isolated command execution → subagents.
          </p>
        </div>
      </aside>

      <main className="main">
        <header>
          <div>
            <h1>SEGA</h1>
            <p>Agentic coding assistant</p>
          </div>
          <span className="status">● Ready</span>
        </header>

        <section className="chat">
          {messages.length === 0 && (
            <div className="empty">
              <div className="logo">S</div>
              <h2>Build with SEGA</h2>
              <p>
                Open a project, inspect its code, debug errors, and ask SEGA
                about the architecture.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <article key={i} className={`message ${m.role}`}>
              <div className="avatar">{m.role === "assistant" ? "S" : "U"}</div>
              <div className="bubble">
                <div className="role">{m.role === "assistant" ? "SEGA" : "You"}</div>
                <MarkdownMessage content={m.content} />
              </div>
            </article>
          ))}

          {busy && (
            <article className="message assistant">
              <div className="avatar">S</div>
              <div className="bubble">
                <div className="role">SEGA</div>
                <div className="thinking">Thinking…</div>
              </div>
            </article>
          )}
        </section>

        <div className="composer">
          {selectedSearch.length > 0 && (
            <div className="context-strip">
              🔎 Using {selectedSearch.length} selected file{selectedSearch.length > 1 ? "s" : ""} as context
            </div>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              files.length
                ? `Ask SEGA about ${projectName || "your project"}…`
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
            <button onClick={send} disabled={busy || !input.trim()}>
              {busy ? "Working…" : "Send ↑"}
            </button>
          </div>
        </div>

        {editRequest && (
          <div className="edit-overlay">
            <div className="edit-modal">
              <div className="edit-modal-header">
                <div>
                  <strong>SEGA wants to modify</strong>
                  <span>{editRequest.path}</span>
                </div>
                <button onClick={() => setEditRequest(null)}>×</button>
              </div>
              <p className="edit-warning">
                Review the complete file below. Nothing is written until you click Apply Change.
              </p>
              <textarea
                className="edit-textarea"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                spellCheck={false}
              />
              <div className="edit-actions">
                <button onClick={() => setEditRequest(null)}>Cancel</button>
                <button className="apply-edit" onClick={applyEdit}>✓ Apply Change</button>
              </div>
            </div>
          </div>
        )}

        {editStatus && (
          <div className="edit-status" role="status">{editStatus}</div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
