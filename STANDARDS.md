# Alpha Development Standards

All applications in the Alpha ecosystem must adhere to these standards.

## 1. Dual-Mode Architecture (MANDATORY)

Every sub-application (e.g., in `apps/`) MUST support **Dual-Mode** operation:

### Mode A: Alpha Monorepo (Primary)
- **Context**: Running inside `pmindl/Alpha` with access to the encrypted vault.
- **Mechanism**: Use `scripts/run-with-secrets.js` to inject `ALPHA_MASTER_KEY` -> Decrypt `secrets/vault.encrypted.json` -> Inject env vars.
- **Commands**: `npm run dev`, `npm start`

### Mode B: Standalone (Secondary)
- **Context**: Running in a separate repo (e.g., `pmindl/invoice-downloader`) or without the vault.
- **Mechanism**: Fallback to standard `.env.local` file.
- **Commands**: `npm run dev:standalone`, `npm start:standalone`

### Implementation Requirement
Your `package.json` scripts must look like this:
```json
"scripts": {
  "dev": "node ../../scripts/run-with-secrets.js <app-name> next dev",
  "dev:standalone": "next dev"
}
```

## 2. Shared Packages

- **@alpha/ui**: All UI components must use the shared design system.
- **@alpha/sdk**: Use for MCP communication with the Master orchestrator.
- **@alpha/security**: Use for encryption/vault access (if needed).

## 3. Testing

- **Runner**: Vitest (v4+)
- **Requirement**: All new features must have unit tests.
- **Command**: `npm test` (must pass in both modes)

## 4. Code Quality

- **Linting**: ESLint (root config)
- **Formatting**: Prettier
- **Strictness**: TypeScript `strict: true`
