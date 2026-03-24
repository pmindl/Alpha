---
description: ARCHIVED — standalone repos no longer used. All apps deploy from pmindl/Alpha monorepo.
---

# ~~Sync Repos~~ — DEPRECATED

> ⛔ **This workflow is obsolete.** Standalone repos (`pmindl/invoice-downloader`, `pmindl/Invoice-Processor`,
> `pmindl/customer-responder`, `pmindl/gmail-labeler`) have been **archived** on GitHub.
>
> All development and deployment flows through the **monorepo** (`pmindl/Alpha`) exclusively.
> See `/deploy-coolify` workflow for the correct deployment procedure.

## Why this was removed

The dual-repo setup (monorepo + standalone repos) caused sync conflicts when:
- Sentinel/Jules security bots merged PRs directly into standalone repos
- Those commits were not reflected in the monorepo
- `git subtree push` then failed with non-fast-forward errors

The solution: single source of truth — **the monorepo is the only repo you push to.**
