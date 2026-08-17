# SEGA Local Agent + Job Agent

## Install

Open Command Prompt in the repository root and run:

```cmd
cd local-agent
npm install
npx playwright install chromium
```

## Start

From the `local-agent` folder:

```cmd
node server.js
```

Keep the terminal open while SEGA is running.

The service provides:

- `/health`
- `/git/status`
- `/git/diff`
- `POST /jobs/apply`

The browser automation uses a persistent Chromium profile in `.sega-browser-profile`, so you can log in to supported job sites manually once. It will not bypass CAPTCHA, OTP, email verification, or human-verification challenges.
