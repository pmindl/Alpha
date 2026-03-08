/**
 * alpha-auth.ts — One-time Google OAuth2 setup for all Alpha sub-apps.
 * 
 * What it does:
 * 1. Starts a local HTTP server
 * 2. Opens the Google consent screen with combined scopes
 * 3. Captures the authorization code via redirect
 * 4. Exchanges it for tokens (including refresh_token)
 * 5. Saves refresh_token to the encrypted vault (or .env.local as fallback)
 * 
 * Usage:
 *   npx tsx scripts/alpha-auth.ts
 * 
 * After running, all sub-apps will use the new credentials automatically
 * via run-with-secrets.js (vault mode) or .env.local (standalone mode).
 */

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const PROJ_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJ_ROOT, '.env');
const VAULT_PATH = path.join(PROJ_ROOT, 'secrets', 'vault.encrypted.json');

// Load root .env for ALPHA_MASTER_KEY
dotenv.config({ path: ENV_FILE });

const PORT = 5678;
const REDIRECT_URI = `http://localhost:${PORT}/rest/oauth2-credential/callback`;

// Combined scopes for ALL sub-apps
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',   // gmail-labeler, customer-responder
    'https://www.googleapis.com/auth/gmail.readonly',  // invoice-processor 
    'https://www.googleapis.com/auth/drive.readonly',  // invoice-processor (read)
    'https://www.googleapis.com/auth/drive.file',      // invoice-processor (upload)
];

async function main() {
    // Need CLIENT_ID and CLIENT_SECRET from vault or env
    let clientId = process.env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // Try vault first
    const MASTER_KEY = process.env.ALPHA_MASTER_KEY;
    let vault: any = null;

    if (MASTER_KEY && fs.existsSync(VAULT_PATH)) {
        try {
            const { VaultManager } = await import('../packages/security/dist/index.js');
            vault = new VaultManager(MASTER_KEY, VAULT_PATH);
            const secrets = vault.getEnvForApp('global');
            clientId = clientId || secrets.GOOGLE_CLIENT_ID;
            clientSecret = clientSecret || secrets.GOOGLE_CLIENT_SECRET;
            console.log('🔐 Using credentials from encrypted vault');
        } catch (error: any) {
            console.warn(`⚠️  Vault load failed: ${error.message}`);
        }
    }

    if (!clientId || !clientSecret) {
        console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
        console.error('   Set them in your vault or .env file');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║         Alpha Google OAuth2 Setup             ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Port 5678 is blocked by Docker, so we will   ║');
    console.log('║  use manual copy-paste mode.                  ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    console.log('1. Click this link to authorize:');
    console.log(`\n${authUrl}\n`);
    console.log('2. After you authorize, the browser will try to redirect to localhost:5678.');
    console.log('   The page will probably say "Site can\'t be reached". THAT IS OK!');
    console.log('3. COPY the entire URL from your browser\'s address bar and paste it below:\n');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Paste the full URL here: ', async (pastedUrl: string) => {
        readline.close();

        try {
            const qs = new url.URL(pastedUrl.trim()).searchParams;
            const code = qs.get('code');
            const error = qs.get('error');

            if (error) {
                console.error(`\n❌ Auth error returned from Google: ${error}`);
                process.exit(1);
            }

            if (!code) {
                console.error('\n❌ Could not find "code=" in the pasted URL. Please try again.');
                process.exit(1);
            }

            console.log('\n🔄 Exchanging authorization code for tokens...');
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                console.error('\n❌ No refresh token returned!');
                console.error('   Fix: Go to https://myaccount.google.com/permissions');
                console.error('   → Revoke access for this app → Run this script again');
                process.exit(1);
            }

            console.log('\n✅ Refresh token obtained!');

            // Save to vault (preferred) or .env.local (fallback)
            if (vault) {
                saveToVault(vault, tokens.refresh_token);
            } else {
                saveToEnvLocal(tokens.refresh_token);
            }

        } catch (err: any) {
            console.error('\n❌ Token exchange failed:', err.message);
        } finally {
            process.exit(0);
        }
    });
}

function saveToVault(vault: any, refreshToken: string) {
    try {
        const existing = vault.getCredential('GOOGLE_REFRESH_TOKEN');
        if (existing) {
            vault.updateCredentialValue('GOOGLE_REFRESH_TOKEN', refreshToken);
            console.log('🔐 Updated GOOGLE_REFRESH_TOKEN in encrypted vault');
        } else {
            vault.addCredential({
                id: 'GOOGLE_REFRESH_TOKEN',
                value: refreshToken,
                description: 'Google OAuth2 refresh token (all sub-apps)',
                scopes: ['global'],
                metadata: {
                    provider: 'google',
                    service: 'oauth2',
                },
                updatedAt: new Date().toISOString(),
            });
            console.log('🔐 Saved GOOGLE_REFRESH_TOKEN to encrypted vault');
        }
        console.log('   All sub-apps will use it automatically via run-with-secrets.js');
    } catch (err: any) {
        console.error(`⚠️  Vault save failed: ${err.message}`);
        console.log('   Falling back to .env.local...');
        saveToEnvLocal(refreshToken);
    }
}

function saveToEnvLocal(refreshToken: string) {
    const envPath = path.join(PROJ_ROOT, '.env.local');
    let content = '';

    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    }

    if (content.includes('GOOGLE_REFRESH_TOKEN=')) {
        content = content.replace(
            /GOOGLE_REFRESH_TOKEN=.*/,
            `GOOGLE_REFRESH_TOKEN="${refreshToken}"`
        );
    } else {
        content += `\nGOOGLE_REFRESH_TOKEN="${refreshToken}"`;
    }

    fs.writeFileSync(envPath, content);
    console.log(`📄 Saved GOOGLE_REFRESH_TOKEN to ${envPath}`);
    console.log('   Sub-apps will use it in standalone mode (dev:standalone)');
}

main();
