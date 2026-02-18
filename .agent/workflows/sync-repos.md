---
description: Sync app code from monorepo to separate GitHub repositories
---

# Sync Repos

Push app directories from the monorepo to their standalone GitHub repos.

## Repo Mapping

| Monorepo Path | GitHub Repo |
|--------------|-------------|
| `apps/invoice-downloader` | `pmindl/invoice-downloader` |
| `apps/invoice-processor` | `pmindl/Invoice-Processor` |
| `apps/customer-responder` | `pmindl/customer-responder` |
| `experiments/canvas` | TBD |

## One-time Setup

Add remotes for each app repo:
```bash
git remote add origin-id https://github.com/pmindl/invoice-downloader.git
git remote add origin-ip https://github.com/pmindl/Invoice-Processor.git
```

## Steps

1. Push Invoice Downloader:
```bash
git subtree push --prefix=apps/invoice-downloader origin-id main
```

2. Push Invoice Processor:
```bash
git subtree push --prefix=apps/invoice-processor origin-ip main
```

## Notes
- Always commit and push to `pmindl/Alpha` (the monorepo) first
- Then sync to individual repos via subtree push
- Shared packages (`@alpha/*`) are consumed via npm, not via subtree
