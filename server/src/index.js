import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",").map(s => s.trim()) || "*"
}));
app.use(express.json({ limit: "2mb" }));

const systemPrompt = `
You are SEGA, an agentic software engineering assistant.

Core behavior:
- Understand the user's project and requested outcome before acting.
- Prefer precise, production-ready code.
- Explain important assumptions and risks.
- Never expose API keys, secrets, or private credentials.
- When a task requires changing files or running commands, describe the intended tool action first.
- Do not claim a command, test, deployment, or file change happened unless the application actually executed it.
- For DevOps work, favor least privilege, reproducibility, observability, rollback plans, and secure defaults.
- For code generation, include complete files or clearly delimited patches when appropriate.
`;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "SEGA AI" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], model } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array" });
    }

    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: model || process.env.AI_MODEL || "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "")
      }))
    });

    const text = response.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    res.json({
      id: response.id,
      model: response.model,
      text
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "SEGA could not complete the request."
    });
  }
});

app.listen(port, () => {
  console.log(`SEGA API listening on http://localhost:${port}`);
});
