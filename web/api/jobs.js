const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(body));
}

function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  throw new Error("The job search model returned invalid JSON.");
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const query = String(body.query || "").trim();
    const resumeText = String(body.resumeText || "").slice(0, 50000);
    const resumeFile = body.resumeFile;
    const profile = body.profile || {};

    if (!query) return json(res, 400, { error: "Job search query is required." });
    if (!resumeText && !resumeFile?.data) {
      return json(res, 400, { error: "Resume is required." });
    }

    const parts = [];
    parts.push({
      text: `You are SEGA's job-search agent. Search the public web for CURRENT job openings matching this request:\n\n${query}\n\nCandidate profile:\n${JSON.stringify(profile)}\n\nCandidate resume text:\n${resumeText}\n\nReturn ONLY JSON with this exact top-level shape: {"jobs":[...]}. Find up to 12 genuinely relevant jobs. Prefer official employer career pages and reputable public job listings. Do not invent jobs, companies, URLs, locations, or requirements. Exclude senior/lead roles and roles clearly requiring more experience than the candidate has. Prioritize fresher, trainee, junior, internship, 0-1 year and entry-level roles. For each job include: company, title, location, experience, url, matchScore (0-100 integer), reason, skills, applicationUrl. applicationUrl should be the best public page where a candidate can apply. url should be the source listing URL. Keep reason concise.`
    });

    if (resumeFile?.data && resumeFile.mimeType) {
      parts.push({
        inline_data: {
          mime_type: resumeFile.mimeType,
          data: resumeFile.data
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are a careful job-search assistant. Use Google Search grounding. Never fabricate a job listing. Return JSON only."
            }]
          },
          contents: [{ role: "user", parts }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 7000,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini job search error", JSON.stringify(data));
      return json(res, response.status === 429 ? 429 : 502, {
        error: data?.error?.message || `Job search failed with HTTP ${response.status}.`
      });
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("")
      .trim();

    const result = extractJson(text);
    const jobs = Array.isArray(result.jobs) ? result.jobs : [];

    return json(res, 200, {
      jobs: jobs
        .filter((job) => job && job.company && job.title && (job.applicationUrl || job.url))
        .slice(0, 12)
        .map((job) => ({
          company: String(job.company),
          title: String(job.title),
          location: String(job.location || "Not specified"),
          experience: String(job.experience || "Not specified"),
          url: String(job.url || job.applicationUrl),
          applicationUrl: String(job.applicationUrl || job.url),
          matchScore: Math.max(0, Math.min(100, Number(job.matchScore) || 0)),
          reason: String(job.reason || "Relevant to the candidate profile."),
          skills: Array.isArray(job.skills) ? job.skills.map(String) : []
        }))
    });
  } catch (error) {
    console.error("SEGA jobs API error", error);
    return json(res, 500, {
      error: error?.message || "SEGA could not search for jobs."
    });
  }
}
