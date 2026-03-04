/**
 * run-with-secrets.js — Dual-mode secret injector
 * 
 * Mode 1 (Alpha Monorepo): Loads credentials from the encrypted vault
 * Mode 2 (Standalone):     Falls back to .env.local in the app directory
 * 
 * Features:
 * - Pre-flight Google token validation (catches revoked tokens early)
 * 
 * Usage: node run-with-secrets.js <appId> <command> [args...]
 */
const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const PROJ_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJ_ROOT, '.env');
const VAULT_PATH = path.join(PROJ_ROOT, 'secrets', 'vault.encrypted.json');

// 1. Parse Arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node run-with-secrets.js <appId> <command> [args...]');
    process.exit(1);
}

const appId = args[0];
const command = args[1];
const commandArgs = args.slice(2);

// 2. Try to load secrets (vault-first, .env.local fallback)
let secrets = {};
let mode = 'none';

// Try Alpha Vault first
dotenv.config({ path: ENV_FILE });
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

if (MASTER_KEY && fs.existsSync(VAULT_PATH)) {
    try {
        const { VaultManager } = require('../packages/security/dist/index.js');
        const vault = new VaultManager(MASTER_KEY, VAULT_PATH);
        secrets = vault.getEnvForApp(appId);
        mode = 'vault';
    } catch (error) {
        console.warn(`⚠️  Vault load failed: ${error.message}`);
        console.warn('   Falling back to .env.local...');
    }
}

// Fallback: load .env.local from the app directory  
if (mode !== 'vault') {
    const localEnvPath = path.join(process.cwd(), '.env.local');
    const rootLocalEnvPath = path.join(PROJ_ROOT, 'apps', appId, '.env.local');

    const envPath = fs.existsSync(localEnvPath) ? localEnvPath :
        fs.existsSync(rootLocalEnvPath) ? rootLocalEnvPath : null;

    if (envPath) {
        const parsed = dotenv.parse(fs.readFileSync(envPath));
        secrets = parsed;
        mode = 'dotenv';
    } else {
        console.warn(`⚠️  No credentials found for [${appId}]`);
        console.warn('   Expected either:');
        console.warn(`   1. ALPHA_MASTER_KEY in ${ENV_FILE} (vault mode)`);
        console.warn(`   2. .env.local in app directory (standalone mode)`);
    }
}

// 3. Report mode
const secretCount = Object.keys(secrets).length;
if (mode === 'vault') {
    console.log(`🔐 [VAULT] Injecting ${secretCount} secrets for [${appId}]`);
} else if (mode === 'dotenv') {
    console.log(`📄 [STANDALONE] Loaded ${secretCount} vars from .env.local for [${appId}]`);
} else {
    console.log(`⚡ [NO-SECRETS] Starting [${appId}] without credentials`);
}

// 4. Pre-flight Google token validation
async function validateGoogleToken() {
    const refreshToken = secrets.GOOGLE_REFRESH_TOKEN;
    const clientId = secrets.GOOGLE_CLIENT_ID;
    const clientSecret = secrets.GOOGLE_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
        return; // No Google creds — not every app needs them
    }

    try {
        const https = require('https');
        const querystring = require('querystring');

        const postData = querystring.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        });

        const result = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'oauth2.googleapis.com',
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        const { status, body } = result;
        const parsed = JSON.parse(body);

        if (status === 200 && parsed.access_token) {
            console.log(`✅ [AUTH] Google token validated for [${appId}]`);
        } else if (parsed.error === 'invalid_grant') {
            console.error(`\n❌ [AUTH] Google refresh token is REVOKED or EXPIRED for [${appId}]`);
            console.error('   The token stored in the vault is no longer valid.');
            console.error('   ┌─────────────────────────────────────────────┐');
            console.error('   │  Run: npx tsx scripts/alpha-auth.ts         │');
            console.error('   │  to re-authorize and get a new token.       │');
            console.error('   └─────────────────────────────────────────────┘');
            process.exit(1);
        } else {
            console.warn(`⚠️  [AUTH] Google token check returned: ${parsed.error || 'unknown'}`);
        }
    } catch (err) {
        // Network error — don't block app startup, let it try
        console.warn(`⚠️  [AUTH] Token pre-check failed (network?): ${err.message}`);
    }
}

// 5. Run pre-flight check, then spawn process
validateGoogleToken().then(() => {
    const child = spawn(command, commandArgs, {
        stdio: 'inherit',
        env: { ...process.env, ...secrets },
        shell: true
    });

    child.on('exit', (code) => {
        process.exit(code ?? 0);
    });
}).catch((err) => {
    console.error(`⚠️  Pre-flight check error: ${err.message}`);
    // Still spawn the app — don't block on pre-flight failures
    const child = spawn(command, commandArgs, {
        stdio: 'inherit',
        env: { ...process.env, ...secrets },
        shell: true
    });
    child.on('exit', (code) => {
        process.exit(code ?? 0);
    });
});

