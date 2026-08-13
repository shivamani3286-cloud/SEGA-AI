import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I'm SEGA. I can help you design, write, debug, review, and explain software. Ask me about code, AWS, Terraform, Docker, GitHub Actions, or your project."
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages([...next, { role: "assistant", content: data.text }]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `SEGA error: ${err.message}`
        }
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
        <button className="new-chat" onClick={() => setMessages([])}>+ New chat</button>
        <div className="nav">
          <div>⌘ Projects</div>
          <div>◈ Agents</div>
          <div>⚡ Skills</div>
          <div>◌ Integrations</div>
        </div>
        <div className="side-note">
          <strong>Agent roadmap</strong>
          <p>Workspace tools, MCP, subagents, memory, hooks, GitHub automation and safe command execution are designed as the next layers.</p>
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
              <p>Generate code, debug errors, design infrastructure, and reason about your projects.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <article key={i} className={`message ${m.role}`}>
              <div className="avatar">{m.role === "assistant" ? "S" : "U"}</div>
              <div className="bubble">
                <div className="role">{m.role === "assistant" ? "SEGA" : "You"}</div>
                <pre>{m.content}</pre>
              </div>
            </article>
          ))}

          {busy && (
            <article className="message assistant">
              <div className="avatar">S</div>
              <div className="bubble"><div className="role">SEGA</div><div className="thinking">Thinking…</div></div>
            </article>
          )}
        </section>

        <div className="composer">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask SEGA to build, debug, review, or explain something…"
            rows={3}
          />
          <div className="composer-bottom">
            <span>Enter to send · Shift+Enter for a new line</span>
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
