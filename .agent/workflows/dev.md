---
description: Start all local development services (Master + Sub-apps + Jules MCP)
---

# Local Development

Start the full Alpha ecosystem locally.

## Prerequisites
- Node.js v18+
- Docker (for LibreChat only)
- `.env` file at monorepo root with `ALPHA_MASTER_KEY`

## Steps

// turbo-all

1. Install dependencies:
```bash
npm install
```

2. Start all services via Turborepo:
```bash
npm run dev
```

This starts:
| Service | Port | App |
|---------|------|-----|
| Master | 3000 | `apps/master` |
| Invoice Downloader | 3001 | `apps/invoice-downloader` |
| Invoice Processor | 3002 | `apps/invoice-processor` |

3. (Optional) Start Jules MCP server:
```bash
cd .agent/jules-mcp && npm start
```
Jules MCP runs on port **3323**.

4. (Optional) Start LibreChat via Docker:
```bash
docker run -p 3080:3080 --env-file apps/librechat/.env librechat-alpha
```
