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
  const folderInput = useRef(null);

  const tree = useMemo(() => files.map(f => f.path).slice(0, 80), [files]);

  async function openFiles(fileList) {
    const selected = Array.from(fileList || [])
      .filter(f => isProbablyText(f.name, f.type))
      .filter(f => !ignored(f.webkitRelativePath || f.name))
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
      const first = loaded[0].path.split("/")[0];
      setProjectName(first || "Workspace");
    }
  }

  function openProject() {
    folderInput.current?.click();
  }

  function clearProject() {
    setFiles([]);
    setProjectName("");
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

    for (const file of files) {
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
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
