const http = require("http");
const { execFile } = require("child_process");
const path = require("path");

const PORT = Number(process.env.SEGA_AGENT_PORT || 8787);

const PROJECT_DIR = process.env.SEGA_PROJECT_DIR
  ? path.resolve(process.env.SEGA_PROJECT_DIR)
  : process.cwd();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  });

  res.end(payload);
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd: PROJECT_DIR,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr.trim() ||
              stdout.trim() ||
              error.message
            )
          );

          return;
        }

        resolve(stdout);
      }
    );
  });
}

function parseStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.slice(3)
    }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end();
    return;
  }

  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, {
        error: "Only GET requests are supported."
      });
    }

    if (req.url === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "SEGA Local Agent",
        projectDir: PROJECT_DIR
      });
    }

    if (req.url === "/git/status") {
      const branch = (
        await runGit([
          "branch",
          "--show-current"
        ])
      ).trim();

      const statusOutput = await runGit([
        "status",
        "--short"
      ]);

      const files = parseStatus(statusOutput);

      return sendJson(res, 200, {
        ok: true,
        branch: branch || "detached HEAD",
        clean: files.length === 0,
        files
      });
    }

    if (req.url === "/git/diff") {
      const diff = await runGit([
        "diff",
        "--no-ext-diff",
        "--unified=3"
      ]);

      return sendJson(res, 200, {
        ok: true,
        diff
      });
    }

    return sendJson(res, 404, {
      error: "Unknown Local Agent endpoint."
    });
  } catch (error) {
    return sendJson(res, 500, {
      error:
        error.message ||
        "Local Agent error."
    });
  }
});

server.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      "SEGA Local Agent running."
    );

    console.log(
      `Project: ${PROJECT_DIR}`
    );

    console.log(
      `URL: http://127.0.0.1:${PORT}`
    );
  }
);
