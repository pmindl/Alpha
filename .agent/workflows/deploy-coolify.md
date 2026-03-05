---
description: Deploy an app to VPS via Coolify — commit, push, sync subtree, trigger deploy, verify
---

# Deploy to Coolify (VPS)

Deploy a sub-app from the Alpha monorepo to the VPS via Coolify.

## Anti-Loop Rules (MANDATORY)
These rules MUST be followed by the agent to prevent infinite polling loops:
- **Max 1 API check call per step** — never call the same endpoint twice in a loop
- **Max 3 deploy attempts per session** — if all 3 fail, stop and ask the user
- **Bounded wait** — use a background script with a 5-minute timeout; terminate it and report after timeout
- **No in-place retries** — if a step fails, proceed to the next step or escalate to user
- **No manual log copying** — use the Coolify API `GET /api/v1/applications/{uuid}/logs` endpoint directly

## App Registry

| App | Coolify UUID | GitHub Subtree Remote | Subtree Prefix |
|-----|-------------|----------------------|----------------|
| `master` | `ncgwsg004s48o0g0osg48wgg` | `origin` (monorepo only) | — |
| `invoice-downloader` | `d8s8g4088wgsww8kgg8g4s44` | `origin-id` | `apps/invoice-downloader` |
| `invoice-processor` | `jc4s48ckw4skw4wwc4o804gs` | `origin-ip` | `apps/invoice-processor` |
| `customer-responder` | `dcws04g00ckw0ws0ogsw0k8s` | TBD | `apps/customer-responder` |
| `gmail-labeler` | `j88ssos8gw8wo4gsgk0gwccw` | `origin-gl` | `apps/gmail-labeler` |

**Coolify API:**
- URL: `http://157.180.124.79:8000/api/v1`
- Token: stored in `scripts/push-coolify-env.ts` (variable `COOLIFY_TOKEN`)

## Steps

1. Make and verify code changes locally.
   - **CRITICAL:** Run `npx turbo run build --filter=<app-name>` locally to verify no TypeScript or linting errors exist. Do NOT commit if this fails.
   - If you added new dependencies, verify `package-lock.json` is updated and committed.
2. Commit and push to monorepo:
```bash
git add apps/<app-name>/
git commit -m "feat(<app-name>): description"
git push origin master
```

3. Sync to the app's standalone GitHub repo (only if it has a subtree remote):
```bash
git subtree push --prefix=apps/<app-name> origin-<short> master
```
> If this is slow/stuck, wait — subtree push recalculates the full history. Do NOT cancel it.

4. Trigger a Coolify deployment (1 attempt only at this step):
```bash
node -e "fetch('http://157.180.124.79:8000/api/v1/deploy', {method:'POST', headers:{'Authorization':'Bearer <TOKEN>','Content-Type':'application/json'}, body: JSON.stringify({uuid:'<APP_UUID>', force_rebuild:true})}).then(r=>r.json()).then(console.log)"
```

   **If response is `"Deployment already queued for this commit."`:**
   - The deploy queue is stuck. Ask the user to cancel all queued/failed deployments in the Coolify GUI under the **Deployments** tab, then retry once.

5. Wait for build completion — use a bounded background script (5-min timeout):
```js
// Auto-terminates after 5 min; write UUID into script before running
node tmp_check_coolify.js
```
   - Poll `GET /api/v1/deployments/{deployment_uuid}` every 10 seconds
   - Stop as soon as status is `finished` or `failed`
   - **Do not poll manually in a loop** — always use the background script

6. Check container logs (1 call only):
```bash
node -e "fetch('http://157.180.124.79:8000/api/v1/applications/<UUID>/logs', {headers:{'Authorization':'Bearer <TOKEN>'}}).then(r=>r.json()).then(d=>console.log(d.logs||d.message))"
```

7. Report result to user — success or specific error message

## Common Build Failures & Fixes

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `MODULE_NOT_FOUND: run-with-secrets.js` | `start` script calls local dev helper | Change `start` to call interpreter directly (`python3 main.py`) |
| `sh: python: not found` | Container has no Python | Add `nixpacks.toml` with `python311` |
| `npm ci` fails | No `package-lock.json` in sub-app dir | Use `npm install` instead |
| `npm install` timeout/OOM | Node deps not needed in production | Remove `npm install` from `nixpacks.toml` entirely if app doesn't need it |
| `Deployment already queued` | Old failed deploy blocking queue | User must cancel stuck deploys in Coolify GUI > Deployments tab |

## Nixpacks.toml Standards

For **Python-only apps** (no Node.js needed at runtime):
```toml
[phases.setup]
nixPkgs = ["python311", "python311Packages.pip"]

[variables]
PIP_BREAK_SYSTEM_PACKAGES = "1"

[phases.install]
cmds = ["pip install -r requirements.txt"]

[start]
cmd = "python3 -X utf8 main.py"
```

For **Node.js apps** (Next.js, etc.):
- No `nixpacks.toml` needed — Nixpacks auto-detects Node
- Ensure `package-lock.json` exists in the sub-app directory OR use `npm install` not `npm ci`

## Verification

After deployment:
1. Container logs show application output (not crash logs)
2. `GET /api/v1/applications/{uuid}` returns `status: running:*`
3. No `not found in map` / `MODULE_NOT_FOUND` / `not found` errors in logs
