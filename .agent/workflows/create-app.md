---
description: Create a new standardized app in the apps/ directory
---
# Create New App Workflow

Use this workflow to generate a new sub-application that fully adheres to Alpha's **Dual-Mode** standards and **Shared Package** architecture.

## Usage

Run the following command from the root of the repository:

```bash
npx tsx scripts/scaffold-new-app.ts <app-name>
```

## Example

```bash
npx tsx scripts/scaffold-new-app.ts inventory-manager
```

## What it does

1.  **Creates Directory**: `apps/<app-name>`
2.  **Configures package.json**: 
    -   Sets up `dev` (Vault Mode) and `dev:standalone` (Standalone Mode)
    -   Adds dependencies: `@alpha/ui`, `@alpha/sdk`, `zod`, `vitest`
3.  **Configures TypeScript**: `tsconfig.json`
4.  **Configures Next.js + Tailwind**: `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
5.  **Adds Scaffolding**: `src/app/page.tsx` (using `@alpha/ui` components)

## After Running

1.  Run `npm install` from the root to link workspaces.
2.  Navigate to `apps/<app-name>`.
3.  Start developing!
