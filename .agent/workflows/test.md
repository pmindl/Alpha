---
description: Run the full test suite across the Alpha monorepo
---

# Run Tests

Execute all tests across the monorepo using Turborepo + Vitest.

## Steps

// turbo-all

1. Run the full test suite:
```bash
npm test
```

This runs `vitest run` in every package/app that has a `test` script:
- `packages/security` — Encryption + VaultManager tests
- `packages/sdk` — MCP Client tests
- `packages/ui` — Button component tests
- `apps/master` — Jules Bridge + MCP Server tests
- `apps/invoice-downloader` — API tests
- `apps/invoice-processor` — Gemini + Page tests

2. Run tests for a specific package:
```bash
cd packages/security && npx vitest run
```

3. Run tests in watch mode (for development):
```bash
cd packages/security && npx vitest
```
