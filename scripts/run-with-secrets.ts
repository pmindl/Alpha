import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { VaultManager } from '../packages/security/src/vault';

const PROJ_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJ_ROOT, '.env');
const VAULT_PATH = path.join(PROJ_ROOT, 'secrets/vault.encrypted.json');

// 1. Parse Arguments
// Usage: tsx run-with-secrets.ts <appId> <command> [args...]
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: tsx run-with-secrets.ts <appId> <command> [args...]');
    process.exit(1);
}

const appId = args[0];
const command = args[1];
const commandArgs = args.slice(2);

// 2. Load Master Key
dotenv.config({ path: ENV_FILE });
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

if (!MASTER_KEY) {
    console.error('❌ ALPHA_MASTER_KEY not found in .env');
    process.exit(1);
}

// 3. Load Secrets
try {
    const vault = new VaultManager(MASTER_KEY, VAULT_PATH);
    const secrets = vault.getEnvForApp(appId);

    const secretCount = Object.keys(secrets).length;
    console.log(`🔐 Injecting ${secretCount} secrets for app: [${appId}]`);

    // 4. Spawn Process
    const child = spawn(command, commandArgs, {
        stdio: 'inherit',
        env: { ...process.env, ...secrets },
        shell: true
    });

    child.on('exit', (code) => {
        process.exit(code ?? 0);
    });

} catch (error) {
    console.error('❌ Failed to load credentials:', error);
    process.exit(1);
}
