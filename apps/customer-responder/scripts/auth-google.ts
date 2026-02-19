import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { VaultManager } from '@alpha/security';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 5678;

// Hardcoded to match Google Console configuration EXACTLY
const REDIRECT_URI = `http://localhost:${PORT}/rest/oauth2-credential/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Define scopes
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.readonly'
];

async function main() {
    console.log("🚀 Starting Google Auth Flow...");
    console.log(`📡 Redirect URI: ${REDIRECT_URI}`);

    const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith('/rest/oauth2-credential/callback')) {
            const qs = new url.URL(req.url, `http://localhost:${PORT}`).searchParams;
            const code = qs.get('code');
            const error = qs.get('error');

            if (error) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Authentication failed! Error: ' + error);
                console.error('❌ Callback Error:', error);
                server.close();
                return;
            }

            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<h1>Success!</h1><p>Authentication successful! You can close this window. Check your terminal.</p>');
                console.log('\n✅ Authorization Code Received!');

                try {
                    const { tokens } = await oauth2Client.getToken(code);
                    console.log('\n✅ Tokens exchanged successfully!');

                    if (!tokens.refresh_token) {
                        console.warn("⚠️  No refresh_token returned. You might need to revoke access first.");
                        console.warn("Try visiting: https://myaccount.google.com/permissions");
                    } else {
                        // 1. Update .env.local
                        updateEnvLocal(tokens.refresh_token);

                        // 2. Update Vault (if Key exists)
                        if (process.env.ALPHA_MASTER_KEY) {
                            await updateVault(tokens.refresh_token);
                        } else {
                            console.log("ℹ️  ALPHA_MASTER_KEY not found. Skipping Vault update.");
                        }
                    }

                } catch (err) {
                    console.error('❌ Error exchanging code for tokens:', err);
                } finally {
                    // Start shutdown timer
                    setTimeout(() => {
                        server.close();
                        process.exit(0);
                    }, 2000);
                }
            }
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(PORT, () => {
        // Construct URL using URLSearchParams to guarantee correct encoding
        const params = new URLSearchParams({
            access_type: 'offline',
            scope: SCOPES.join(' '),
            response_type: 'code', // Explicitly guaranteed
            client_id: CLIENT_ID!,
            redirect_uri: REDIRECT_URI,
            prompt: 'consent',
            include_granted_scopes: 'true'
        });

        const manualAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        console.log(`\n🚀 Authentication Server listening on port ${PORT}`);
        console.log('-------------------------------------------------------');
        console.log('🔗 OPENING BROWSER AUTOMATICALLY...');
        console.log(manualAuthUrl);
        console.log('-------------------------------------------------------');

        // Auto-open browser
        const startCommand = process.platform === 'win32' ? 'start' : 'open';
        exec(`${startCommand} "${manualAuthUrl}"`); // Quotation marks for safety on Windows

        console.log('Waiting for callback...');
    });

    server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use! Please kill it manually or try again.`);
            process.exit(1);
        } else {
            console.error('Server error:', e);
        }
    });
}

function updateEnvLocal(refreshToken: string) {
    try {
        let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const regex = /^GOOGLE_REFRESH_TOKEN=.*$/m;

        if (regex.test(content)) {
            content = content.replace(regex, `GOOGLE_REFRESH_TOKEN="${refreshToken}"`);
        } else {
            content += `\nGOOGLE_REFRESH_TOKEN="${refreshToken}"`;
        }

        fs.writeFileSync(envPath, content);
        console.log("📄 Updated .env.local");
    } catch (e) {
        console.error("❌ Failed to update .env.local", e);
    }
}

async function updateVault(refreshToken: string) {
    try {
        const vaultPath = path.resolve(process.cwd(), '../../secrets/vault.encrypted.json');

        // Use basic try-catch for dynamic import/usage to be safe
        try {
            const vault = new VaultManager(process.env.ALPHA_MASTER_KEY!, vaultPath);

            // Check if exists
            const existing = vault.getCredential('GOOGLE_REFRESH_TOKEN');
            if (existing) {
                vault.updateCredentialValue('GOOGLE_REFRESH_TOKEN', refreshToken);
                console.log("🔐 Updated GOOGLE_REFRESH_TOKEN in Alpha Vault");
            } else {
                vault.addCredential({
                    id: 'GOOGLE_REFRESH_TOKEN',
                    value: refreshToken,
                    description: 'Google OAuth2 Refresh Token',
                    scopes: ['global'],
                    updatedAt: new Date().toISOString(),
                    metadata: { provider: 'google', service: 'gmail' }
                });
                console.log("🔐 Added new GOOGLE_REFRESH_TOKEN to Alpha Vault");
            }
        } catch (innerErr) {
            console.error("⚠️  Vault update logic error (might be okay if Vault not initialized):", innerErr);
        }

    } catch (e) {
        console.error("❌ Failed to update Vault (outer):", e);
    }
}

main();
