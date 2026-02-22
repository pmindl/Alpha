# ============================================================
# Alpha Monorepo — Shared Dockerfile for Next.js Apps
# ============================================================
#
# This Dockerfile is designed to build any Next.js app in the
# Alpha monorepo, with access to shared @alpha/* packages.
#
# Usage from Coolify:
#   Build Pack: Dockerfile
#   Dockerfile Location: Dockerfile (this file, at app root)
#   Base Directory: /apps/<app-name>
#
# The Dockerfile is placed in each app directory, and Coolify
# sets the build context to the monorepo root automatically
# when using the "Dockerfile Location" relative to base dir.
#
# Build args:
#   APP_NAME  — name of the app directory (e.g., "master")
#   APP_PORT  — port the app listens on (e.g., 3000)
# ============================================================

FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ──
FROM base AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./

# Copy all package.json files for workspaces
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/security/package.json ./packages/security/
COPY packages/ts-config/package.json ./packages/ts-config/
COPY packages/ui/package.json ./packages/ui/

# Copy all app package.json files
COPY apps/master/package.json ./apps/master/
COPY apps/invoice-downloader/package.json ./apps/invoice-downloader/
COPY apps/invoice-processor/package.json ./apps/invoice-processor/
COPY apps/customer-responder/package.json ./apps/customer-responder/
COPY apps/gmail-labeler/package.json ./apps/gmail-labeler/

RUN npm ci

# ── Stage 2: Build ──
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

# Build shared packages first, then the target app
RUN npx turbo run build --filter=${APP_NAME}

# ── Stage 3: Production runner ──
FROM base AS runner
WORKDIR /app

ARG APP_PORT=3000
ENV NODE_ENV=production
ENV PORT=${APP_PORT}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs

EXPOSE ${APP_PORT}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/${APP_NAME}/server.js"]
