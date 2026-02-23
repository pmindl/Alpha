# ============================================================
# Alpha Monorepo — Shared Dockerfile for Next.js Apps
# ============================================================
#
# Build args:
#   APP_NAME  — name of the app directory (e.g., "master")
#   APP_PORT  — port the app listens on (e.g., 3000)
#
# Coolify config per app:
#   Build Pack: Dockerfile
#   Dockerfile Location: /Dockerfile
#   Base Directory: /
#   Environment variable: APP_NAME=<app-name>
#   Environment variable: APP_PORT=<port>
# ============================================================

FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ──
FROM base AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./

# Copy ALL workspace package.json files using a glob-friendly approach.
# We copy the entire packages/ and apps/ trees first (just package.json),
# then run npm ci to resolve the workspace graph.
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN npm ci

# ── Stage 2: Build ──
FROM base AS builder
WORKDIR /app

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY package.json package-lock.json turbo.json ./

# Bust Docker cache to ensure latest source is used
ARG CACHEBUST=1
# Copy the full source code
COPY . .

# Build shared packages first, then the target app
RUN npx turbo run build --filter=${APP_NAME}

# ── Stage 3: Production runner ──
FROM base AS runner
WORKDIR /app

ARG APP_NAME
ARG APP_PORT=3000
ENV NODE_ENV=production
ENV PORT=${APP_PORT}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static

# Copy public directory if it exists (not all apps have one)
COPY --from=builder /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs

EXPOSE ${APP_PORT}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/${APP_NAME}/server.js"]
