/**
 * PM2 Ecosystem Configuration — Alpha Monorepo
 *
 * Production process manager config for Hetzner VPS deployment.
 * Each app runs via `run-with-secrets.js` to inject vault credentials.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs --update-env
 *   pm2 status
 *   pm2 logs
 */

module.exports = {
    apps: [
        // ──── Master Dashboard + MCP ────
        {
            name: 'master',
            cwd: './apps/master',
            script: '../../scripts/run-with-secrets.js',
            args: 'master next start -H 0.0.0.0',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },

        // ──── Invoice Downloader (App + MCP) ────
        {
            name: 'invoice-downloader',
            cwd: './apps/invoice-downloader',
            script: '../../scripts/run-with-secrets.js',
            args: 'invoice-downloader next start -p 3001 -H 0.0.0.0',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'invoice-downloader-mcp',
            cwd: './apps/invoice-downloader',
            script: '../../scripts/run-with-secrets.js',
            args: 'invoice-downloader tsx src/mcp-server.ts --transport=sse',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production'
            }
        },

        // ──── Invoice Processor (App + MCP) ────
        {
            name: 'invoice-processor',
            cwd: './apps/invoice-processor',
            script: '../../scripts/run-with-secrets.js',
            args: 'invoice-processor next start -p 3002 -H 0.0.0.0',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'invoice-processor-mcp',
            cwd: './apps/invoice-processor',
            script: '../../scripts/run-with-secrets.js',
            args: 'invoice-processor tsx src/mcp-server.ts --transport=sse',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production'
            }
        },

        // ──── Customer Responder (App + MCP) ────
        {
            name: 'customer-responder',
            cwd: './apps/customer-responder',
            script: '../../scripts/run-with-secrets.js',
            args: 'customer-responder next start -p 3004 -H 0.0.0.0',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'customer-responder-mcp',
            cwd: './apps/customer-responder',
            script: '../../scripts/run-with-secrets.js',
            args: 'customer-responder tsx src/mcp-server.ts --transport=sse',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production'
            }
        },

        // ──── Gmail Labeler (MCP only) ────
        {
            name: 'gmail-labeler-mcp',
            cwd: './apps/gmail-labeler',
            script: '../../scripts/run-with-secrets.js',
            args: 'gmail-labeler tsx src/mcp-server.ts --transport=sse',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
