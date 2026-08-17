# SEGA AI


SEGA Local Agent + Job Agent
Install
Open Command Prompt in the repository root and run:
```cmd
cd local-agent
npm install
npx playwright install chromium
```
Start
From the `local-agent` folder:
```cmd
node server.js
```
Keep the terminal open while SEGA is running.
The service provides:
`/health`
`/git/status`
`/git/diff`
`POST /jobs/apply`
The browser automation uses a persistent Chromium profile in `.sega-browser-profile`, so you can log in to supported job sites manually once. It will not bypass CAPTCHA, OTP, email verification, or human-verification challenges.

SEGA is an independent agentic coding-assistant project.

## Current deployment

The Vercel project uses `web` as its Root Directory.

The frontend is a Vite app and the AI endpoint is a Vercel Function at:

`/api/chat`

## Free AI setup

SEGA can use the Gemini API Free Tier. Google currently lists free input/output
for selected Gemini models; `gemini-3.5-flash-lite` is one of the listed free-tier
models. Free-tier rate limits apply.

1. Create a Gemini API key in Google AI Studio.
2. In Vercel, open the `sega-ai` project.
3. Go to Settings → Environment Variables.
4. Add:
   - Name: `GEMINI_API_KEY`
   - Value: your key
   - Environments: Production, Preview, Development
5. Optional:
   - Name: `GEMINI_MODEL`
   - Value: `gemini-3.5-flash-lite`
6. Redeploy.

Never put the real API key in GitHub or frontend code.

## Local frontend

```bash
cd web
npm install
npm run dev
```

## Important architecture rule

SEGA does not get unrestricted shell or filesystem access from a public browser
endpoint. Future workspace/terminal tools must run behind authentication and
explicit approval, preferably in an isolated sandbox.


## Workspace v1

SEGA v1 can analyze a local project without uploading it to persistent storage.

- Click **Open project**.
- Select a project folder in a Chromium-based browser.
- SEGA indexes supported text files in the browser.
- A bounded amount of file content is included with the chat request.
- The backend treats workspace content as untrusted data.
- This version is **read-only**: it does not edit files or execute commands.

This is intentionally the first safe step toward an agent. File editing and
command execution should be added only with explicit user approval and an
isolated execution environment.



## Chat formatting v2

SEGA now renders Markdown responses with:
- headings and lists
- syntax-labelled code blocks
- a code-block header
- one-click **Copy** buttons
- separate code blocks for separate files
- Markdown tables and inline code

The AI is instructed to put a file name immediately above complete files, for example:

### Dockerfile

```dockerfile
FROM nginx:alpine
```
SEGA Local Agent

This small local service gives the SEGA web app safe, read-only access to Git status and Git diff.

Start it

Open Git Bash in the root of the Git repository you want SEGA to inspect:

node local-agent/server.js

The agent listens only on:

http://127.0.0.1:8787

It does not expose arbitrary shell commands.

Endpoints

GET /health
GET /git/status
GET /git/diff

The service runs Git with the current working directory as the repository.

To point it at another repository:

Git Bash

SEGA_PROJECT_DIR="C:/path/to/your/repository" node local-agent/server.js

PowerShell

$env:SEGA_PROJECT_DIR="C:\path\to\your\repository"
node local-agent/server.js

Keep the terminal running while using the Git features in SEGA.
