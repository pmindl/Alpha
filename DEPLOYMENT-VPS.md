# Coolify Deployment Guide — Alpha Monorepo

Deploy all Alpha apps to your Hetzner VPS using Coolify.

## Prerequisites

- Hetzner VPS with **Coolify** installed
- Domain name with DNS access
- GitHub repository: `pmindl/Alpha`

---

## Step 1: Connect GitHub

1. Open Coolify Dashboard → **Sources** → **Add GitHub App**
2. Authorize access to `pmindl/Alpha`

## Step 2: Create Project

1. **Projects** → **New Project** → Name it **"Alpha"**
2. Create an **environment** (e.g., "Production")

## Step 3: Deploy Each App

For each app below, click **+ New Resource** → **Application** → **GitHub** → select `pmindl/Alpha`:

### Next.js Apps

| Setting | master | invoice-downloader | invoice-processor | customer-responder |
|---------|--------|-------------------|-------------------|-------------------|
| **Branch** | `main` | `main` | `main` | `main` |
| **Base Directory** | `/` | `/` | `/` | `/` |
| **Build Pack** | Dockerfile | Dockerfile | Dockerfile | Dockerfile |
| **Dockerfile Location** | `Dockerfile` | `Dockerfile` | `Dockerfile` | `Dockerfile` |
| **Build Args** | `APP_NAME=master` `APP_PORT=3000` | `APP_NAME=invoice-downloader` `APP_PORT=3001` | `APP_NAME=invoice-processor` `APP_PORT=3002` | `APP_NAME=customer-responder` `APP_PORT=3004` |
| **Port** | 3000 | 3001 | 3002 | 3004 |
| **Domain** | `master.YOUR_DOMAIN` | `invoices.YOUR_DOMAIN` | `processor.YOUR_DOMAIN` | `responder.YOUR_DOMAIN` |
| **Watch Paths** | `apps/master/**` `packages/**` | `apps/invoice-downloader/**` `packages/**` | `apps/invoice-processor/**` `packages/**` | `apps/customer-responder/**` `packages/**` |

> **Build Args**: In Coolify, go to the app's settings → Build tab → add build arguments `APP_NAME` and `APP_PORT`.

> **Environment Variables**: Add all secrets for each app (copy from your vault's contents for that app). These replace the vault mechanism inside containers.

### MCP Servers (Optional)

For each MCP server, create a separate resource with Nixpacks:

| Setting | invoice-processor-mcp | invoice-downloader-mcp | gmail-labeler-mcp | customer-responder-mcp |
|---------|----------------------|----------------------|-------------------|----------------------|
| **Base Directory** | `/apps/invoice-processor` | `/apps/invoice-downloader` | `/apps/gmail-labeler` | `/apps/customer-responder` |
| **Build Pack** | Nixpacks | Nixpacks | Nixpacks | Nixpacks |
| **Start Command** | `npx tsx src/mcp-server.ts --transport=sse` | `npx tsx src/mcp-server.ts --transport=sse` | `npx tsx src/mcp-server.ts --transport=sse` | `npx tsx src/mcp-server.ts --transport=sse` |
| **Port** | 4001 | 4002 | 4003 | 4004 |

### LibreChat (Docker Compose)

1. **+ New Resource** → **Docker Compose**
2. Source: GitHub → `pmindl/Alpha` → branch `main`
3. **Base Directory**: `/apps/librechat`
4. **Domain**: `chat.YOUR_DOMAIN`
5. Add environment variables from `apps/librechat/.env`

## Step 4: Set Up Auto-Deploy

### Option A: Coolify GitHub Webhook (automatic)

Coolify auto-creates GitHub webhooks when you connect the repo. Every push to `main` triggers a rebuild of apps with matching Watch Paths.

### Option B: GitHub Actions + Coolify API (with tests)

For running tests before deployment:

1. In Coolify → **Settings** → **API** → create an API token
2. In Coolify → each app → **Webhooks** → copy the webhook URL
3. In GitHub → **Settings** → **Secrets** → add:
   - `COOLIFY_TOKEN` — your API token
   - `COOLIFY_WEBHOOK` — the webhook URL

The workflow at `.github/workflows/deploy.yml` will run tests, then trigger Coolify.

## Step 5: Configure DNS

Add A records pointing your subdomains to the VPS IP:

```
master.yourdomain.com    → YOUR_VPS_IP
invoices.yourdomain.com  → YOUR_VPS_IP
processor.yourdomain.com → YOUR_VPS_IP
responder.yourdomain.com → YOUR_VPS_IP
chat.yourdomain.com      → YOUR_VPS_IP
```

Coolify + Traefik will handle SSL certificates automatically.

---

## Verification

1. Check Coolify Dashboard — all apps should show **Running** (green)
2. Visit each subdomain — verify SSL lock icon
3. Push a test commit to `main` — watch auto-deployment in Coolify logs

## Useful Coolify Features

- **Logs**: Click any app → Logs tab for real-time output
- **Restart**: One-click restart per app
- **Rollback**: Rollback to any previous deployment
- **Monitoring**: Built-in resource usage metrics
