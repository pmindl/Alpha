---
description: Sync app code from monorepo to separate GitHub repositories
---

# Sync Repos

Push app directories from the monorepo to their standalone GitHub repos via `git subtree push`.

## Repo Mapping

| App | Monorepo Prefix | Remote | Standalone Repo |
|-----|----------------|--------|----------------|
| `invoice-downloader` | `apps/invoice-downloader` | `origin-id` | `pmindl/invoice-downloader` |
| `invoice-processor` | `apps/invoice-processor` | `origin-ip` | `pmindl/Invoice-Processor` |
| `customer-responder` | `apps/customer-responder` | TBD | `pmindl/customer-responder` |
| `gmail-labeler` | `apps/gmail-labeler` | `origin-gl` | `pmindl/gmail-labeler` |

## One-time Setup

Add remotes for each app repo (run once per machine):
```bash
git remote add origin-id https://github.com/pmindl/invoice-downloader.git
git remote add origin-ip https://github.com/pmindl/Invoice-Processor.git
git remote add origin-gl https://github.com/pmindl/gmail-labeler.git
```

## Steps

1. Always commit and push to the monorepo first:
```bash
git add apps/<app-name>/
git commit -m "feat(<app-name>): description"
git push origin master
```

2. Sync to the standalone repo:
```bash
git subtree push --prefix=apps/invoice-downloader origin-id master
git subtree push --prefix=apps/invoice-processor origin-ip master
git subtree push --prefix=apps/gmail-labeler origin-gl master
```

> ⚠️ `git subtree push` recalculates the full commit history. It can take 60–120 seconds. Wait for it — do NOT cancel.

## Notes
- Branch is `master` (not `main`) for all repos in this project
- Shared packages (`@alpha/*`) are consumed via npm, not via subtree
- Coolify watches the standalone repos — a subtree push triggers auto-deploy
- See `/deploy-coolify` workflow for full Coolify deploy procedure and anti-loop rules
