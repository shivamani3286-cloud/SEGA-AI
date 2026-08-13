const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const SYSTEM_PROMPT = `
You are SEGA, an independent agentic software engineering assistant.

Help with:
- software development and code generation
- debugging and error analysis
- code review and refactoring
- AWS, Terraform, Docker, Linux, Nginx, Git and GitHub Actions
- architecture and DevOps explanations

Rules:
- Give practical, production-minded answers.
- Do not claim that you executed commands, changed files, deployed infrastructure,
  accessed a repository, or ran tests unless a real tool actually did so.
- Never request or reveal API keys, passwords, tokens, or other secrets.
- Prefer secure, least-privilege solutions.
- When code is requested, provide complete usable snippets and explain where they go.
`;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return json(res, 500, {
      error: "GEMINI_API_KEY is not configured in Vercel."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const messages = Array.isArray(body?.messages)
      ? body.messages
      : [];

    if (!messages.length) {
      return json(res, 400, {
        error: "messages must contain at least one message."
      });
    }

    const contents = messages
      .filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        MODEL
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 4096
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", JSON.stringify(data));

      return json(res, response.status === 429 ? 429 : 502, {
        error:
          data?.error?.message ||
          `Gemini request failed with HTTP ${response.status}.`
      });
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("")
      .trim();

    if (!text) {
      return json(res, 502, {
        error: "The model returned an empty response."
      });
    }

    return json(res, 200, {
      text,
      model: MODEL
    });
  } catch (error) {
    console.error("SEGA API error:", error);

    return json(res, 500, {
      error: "SEGA could not process the request."
    });
  }
}
