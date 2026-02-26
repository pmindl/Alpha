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

## 5. Security & Content Security Policy (CSP)

Some applications in this repository (e.g. `experiments/canvas` or production builds) utilize a strict Content Security Policy (CSP) injected via a `<meta>` tag in `index.html`. 

**Current default CSP:**
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none';`

### Troubleshooting CSP Issues
If you encounter browser console errors stating that a script, image, or font was blocked by the Content Security Policy, **do not immediately remove the CSP tag**. Instead, carefully update it:

1. **External Fonts (Google Fonts, etc.):** 
   Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`.
   
2. **External Images (Avatars, CDN links):** 
   Add the specific domain (e.g., `https://avatars.githubusercontent.com`) to `img-src`.

3. **External Scripts/Analytics (PostHog, Stripe, etc.):** 
   Add the specific domain to `script-src` and `connect-src`. If the script requires inline evaluation, you may need to add `'unsafe-eval'`.

By default, maintain the "walled garden" approach and only open specific domains when absolutely necessary.
