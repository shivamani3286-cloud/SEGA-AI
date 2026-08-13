# SEGA architecture

## Target capability set

SEGA is planned as an agentic coding platform with these layers:

1. **Chat/UI** — conversation, code blocks, diffs, approvals, task status.
2. **Model gateway** — Anthropic/OpenAI-compatible/local providers behind one interface.
3. **Agent loop** — reason → choose tool → execute → inspect result → continue.
4. **Workspace tools** — read/search/edit/create/rename files.
5. **Execution tools** — test, lint, build, git and approved shell commands.
6. **Web tools** — search/fetch documentation and error references.
7. **Skills** — reusable workflows such as `/deploy`, `/review`, `/terraform`, `/docker`.
8. **Subagents** — isolated specialists for security, testing, architecture, research.
9. **MCP** — external services such as GitHub, databases, cloud tooling and browsers.
10. **Hooks/policies** — pre/post tool checks, secret protection and command approval.
11. **Memory** — project instructions and durable user/project preferences.
12. **GitHub automation** — issue-to-PR, code review and CI repair.
13. **Observability** — tool traces, cost/latency metrics and audit logs.

## Security rule

Never expose an unrestricted shell or filesystem tool from a public browser endpoint. Local execution should run in a trusted local agent process, or in an isolated sandbox/container with explicit permissions.

## Deployment

Recommended split:
- React/Vite UI → Vercel
- API/agent service → a protected server/container
- Secrets → server-side environment variables
- GitHub access → short-lived OAuth/app credentials
