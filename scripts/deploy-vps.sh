#!/bin/bash
# ============================================================
# Alpha Monorepo — Manual VPS Deploy Script
# ============================================================
#
# Use this for initial setup or as a fallback when GitHub Actions
# is not available. For normal deployments, push to main branch.
#
# Usage:
#   ./scripts/deploy-vps.sh [user@host]
#
# Example:
#   ./scripts/deploy-vps.sh deploy@123.45.67.89
#
# ============================================================

set -euo pipefail

# ── Configuration ──
REMOTE="${1:?Usage: ./scripts/deploy-vps.sh user@host}"
REMOTE_DIR="~/alpha"
SSH_PORT="${VPS_SSH_PORT:-22}"

echo "🚀 Deploying Alpha to ${REMOTE}..."
echo "   Remote directory: ${REMOTE_DIR}"
echo ""

# ── Step 1: Run local tests ──
echo "🧪 Running tests locally..."
npm test || {
    echo "❌ Tests failed. Aborting deployment."
    exit 1
}

# ── Step 2: Push to GitHub ──
echo "📤 Pushing to GitHub..."
CURRENT_BRANCH=$(git branch --show-current)
git push origin "${CURRENT_BRANCH}"

# ── Step 3: Deploy on VPS ──
echo "🖥️  Connecting to VPS..."
ssh -p "${SSH_PORT}" "${REMOTE}" << 'DEPLOY_SCRIPT'
set -e

cd ~/alpha

echo "📦 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "📥 Installing dependencies..."
npm ci

echo "🔨 Building..."
npx turbo run build

echo "♻️  Reloading PM2..."
pm2 reload ecosystem.config.cjs --update-env
pm2 save

echo "🐳 Updating LibreChat..."
cd apps/librechat
docker compose pull
docker compose up -d --remove-orphans
cd ~/alpha

echo ""
echo "✅ Deployment complete!"
pm2 status
DEPLOY_SCRIPT

echo ""
echo "🎉 Done! All services reloaded on ${REMOTE}"
