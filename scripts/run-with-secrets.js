/**
 * run-with-secrets.js — Dual-mode secret injector
 * 
 * Mode 1 (Alpha Monorepo): Loads credentials from the encrypted vault
 * Mode 2 (Standalone):     Falls back to .env.local in the app directory
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
        // Don't exit — let the app try to start anyway (some features may work without secrets)
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

// 4. Spawn Process
const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: { ...process.env, ...secrets },
    shell: true
});

child.on('exit', (code) => {
    process.exit(code ?? 0);
});
