const http = require("http");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.SEGA_AGENT_PORT || 8787);
const PROJECT_DIR = process.env.SEGA_PROJECT_DIR
  ? path.resolve(process.env.SEGA_PROJECT_DIR)
  : process.cwd();
const BROWSER_PROFILE = path.join(PROJECT_DIR, ".sega-browser-profile");
const TEMP_DIR = path.join(PROJECT_DIR, ".sega-temp");

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20 * 1024 * 1024) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON request."));
      }
    });
    req.on("error", reject);
  });
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, {
      cwd: PROJECT_DIR,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || stdout.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseStatus(output) {
  return output.split(/\r?\n/).filter(Boolean).map((line) => ({
    code: line.slice(0, 2),
    path: line.slice(3)
  }));
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inputScore(input, tokens) {
  const value = cleanText(input).toLowerCase();
  return tokens.reduce((score, token) => score + (value.includes(token) ? 1 : 0), 0);
}

async function applyJob(body) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    throw new Error("Playwright is not installed. In local-agent run: npm install && npx playwright install chromium");
  }

  const job = body.job || {};
  const profile = body.profile || {};
  const resume = body.resume || {};
  const target = job.applicationUrl || job.url;

  if (!target) throw new Error("Job has no application URL.");
  if (!profile.name || !profile.email) throw new Error("Name and email are required.");
  if (!resume.data) throw new Error("Resume file data is required.");

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(BROWSER_PROFILE, { recursive: true });

  const safeName = path.basename(resume.name || "resume.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const resumePath = path.join(TEMP_DIR, `${Date.now()}-${safeName}`);
  fs.writeFileSync(resumePath, Buffer.from(resume.data, "base64"));

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE, {
    headless: false,
    viewport: { width: 1440, height: 1000 }
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);

    const bodyText = cleanText(await page.locator("body").innerText().catch(() => ""));
    if (/captcha|recaptcha|hcaptcha|verify you are human/i.test(bodyText)) {
      return {
        status: "manual_required",
        message: "CAPTCHA or human verification detected. SEGA stopped instead of bypassing it."
      };
    }

    if (/one[- ]time password|otp|verification code|verify your email/i.test(bodyText)) {
      return {
        status: "manual_required",
        message: "OTP/email verification is required. SEGA stopped for manual action."
      };
    }

    const fields = [
      { tokens: ["full name", "name"], value: profile.name },
      { tokens: ["first name", "given name"], value: String(profile.name).split(/\s+/)[0] },
      { tokens: ["last name", "surname", "family name"], value: String(profile.name).split(/\s+/).slice(1).join(" ") },
      { tokens: ["email", "e-mail"], value: profile.email },
      { tokens: ["phone", "mobile", "telephone"], value: profile.phone },
      { tokens: ["city", "location"], value: profile.location },
      { tokens: ["linkedin"], value: profile.linkedin }
    ];

    for (const field of fields) {
      if (!field.value) continue;
      const candidates = page.locator("input, textarea");
      const count = await candidates.count();
      for (let i = 0; i < count; i++) {
        const el = candidates.nth(i);
        const meta = [
          await el.getAttribute("name").catch(() => ""),
          await el.getAttribute("id").catch(() => ""),
          await el.getAttribute("placeholder").catch(() => ""),
          await el.getAttribute("aria-label").catch(() => "")
        ].join(" ").toLowerCase();
        if (inputScore(meta, field.tokens) > 0) {
          await el.fill(String(field.value)).catch(() => {});
          break;
        }
      }
    }

    const fileInputs = page.locator('input[type="file"]');
    const fileCount = await fileInputs.count();
    for (let i = 0; i < fileCount; i++) {
      const el = fileInputs.nth(i);
      const meta = [
        await el.getAttribute("name").catch(() => ""),
        await el.getAttribute("id").catch(() => ""),
        await el.getAttribute("aria-label").catch(() => "")
      ].join(" ").toLowerCase();
      if (/resume|cv|curriculum|upload/.test(meta) || fileCount === 1) {
        await el.setInputFiles(resumePath).catch(() => {});
        break;
      }
    }

    const afterFillText = cleanText(await page.locator("body").innerText().catch(() => ""));
    if (/captcha|recaptcha|hcaptcha|verify you are human/i.test(afterFillText)) {
      return {
        status: "manual_required",
        message: "Human verification appeared while filling the application. Review the open browser window."
      };
    }

    const submit = page.getByRole("button", { name: /submit application|submit|apply now|apply/i }).first();
    if (await submit.count()) {
      await submit.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);
    } else {
      const inputSubmit = page.locator('input[type="submit"], button[type="submit"]').first();
      if (await inputSubmit.count()) {
        await inputSubmit.click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(2000);
      } else {
        return {
          status: "manual_required",
          message: "SEGA filled the recognizable fields but could not safely identify a submit button. Review the open browser window."
        };
      }
    }

    const resultText = cleanText(await page.locator("body").innerText().catch(() => ""));
    if (/captcha|recaptcha|hcaptcha|verify you are human|otp|verification code/i.test(resultText)) {
      return {
        status: "manual_required",
        message: "The site requested human verification after form submission. SEGA did not bypass it."
      };
    }

    if (/application submitted|successfully applied|thank you for applying|application received|application complete/i.test(resultText)) {
      return {
        status: "submitted",
        message: "Application submitted successfully according to the page response."
      };
    }

    return {
      status: "manual_required",
      message: "SEGA submitted the form attempt but could not verify a successful application. Check the open browser window before closing it."
    };
  } finally {
    try { fs.unlinkSync(resumePath); } catch {}
    await context.close().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  try {
    const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "SEGA Local Agent",
        projectDir: PROJECT_DIR,
        jobAutomation: true
      });
    }

    if (req.method === "GET" && pathname === "/git/status") {
      const branch = (await runGit(["branch", "--show-current"])).trim();
      const statusOutput = await runGit(["status", "--short"]);
      const files = parseStatus(statusOutput);
      return sendJson(res, 200, {
        ok: true,
        branch: branch || "detached HEAD",
        clean: files.length === 0,
        files
      });
    }

    if (req.method === "GET" && pathname === "/git/diff") {
      const diff = await runGit(["diff", "--no-ext-diff", "--unified=3"]);
      return sendJson(res, 200, { ok: true, diff });
    }

    if (req.method === "POST" && pathname === "/jobs/apply") {
      const body = await readBody(req);
      const result = await applyJob(body);
      return sendJson(res, 200, { ok: true, ...result });
    }

    return sendJson(res, 404, { error: "Unknown Local Agent endpoint." });
  } catch (error) {
    console.error("SEGA Local Agent error:", error);
    return sendJson(res, 500, { error: error?.message || "Local Agent error." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("SEGA Local Agent running.");
  console.log(`Project: ${PROJECT_DIR}`);
  console.log(`URL: http://127.0.0.1:${PORT}`);
  console.log("Git status/diff and Job Agent automation are enabled.");
});
