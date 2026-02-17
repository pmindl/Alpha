---
description: Publish @alpha/* packages to GitHub Packages
---

# Publish Packages

Publish shared `@alpha/*` packages to GitHub Packages so separate app repos can install them.

## Prerequisites
- GitHub Personal Access Token with `write:packages` scope
- Set `NPM_TOKEN` environment variable

## Steps

1. Authenticate with GitHub Packages:
```bash
echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> ~/.npmrc
echo "@alpha:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

2. Bump versions if needed:
```bash
cd packages/security && npm version patch
cd packages/sdk && npm version patch
cd packages/ui && npm version patch
```

3. Publish each package:
```bash
cd packages/security && npm publish
cd packages/sdk && npm publish
cd packages/ui && npm publish
cd packages/ts-config && npm publish
```

## Consuming from separate repos

In each app repo (e.g., `pmindl/invoice-downloader`):

1. Create `.npmrc`:
```
@alpha:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

2. Install:
```bash
npm install @alpha/ui @alpha/security @alpha/sdk
```
