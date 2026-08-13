# SEGA AI

SEGA is an independent agentic coding-assistant project inspired by modern coding-agent workflows.

## Important
This project is an independent implementation. It does not contain Anthropic's Claude model or the closed-source Claude Code CLI.

## Stack
- React + Vite frontend
- Express backend
- Provider abstraction for Anthropic/OpenAI-compatible APIs
- Safe-by-default tool architecture planned for workspace operations
- Designed to deploy the frontend to Vercel and the API separately

## Run

### Backend
```bash
cd server
npm install
copy .env.example .env
npm run dev
```

### Frontend
```bash
cd web
npm install
npm run dev
```

Never commit API keys. Use `.env` locally and Vercel/server environment variables in production.
