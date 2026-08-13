# SEGA AI

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
