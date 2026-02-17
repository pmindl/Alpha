const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Path to Alpha Security Build (assumes built via root 'turbo run build')
const SECURITY_PATH = path.resolve(__dirname, '../../../packages/security/dist/index.js');
const VALUES_PATH = path.resolve(__dirname, '../../../secrets/vault.encrypted.json');
const ENV_PATH = path.resolve(__dirname, '../../../.env');

// Manually load .env from root to ensure ALPHA_MASTER_KEY is available
if (fs.existsSync(ENV_PATH)) {
    try {
        const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // Remove quotes
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
        console.log('📄 Loaded .env from root.');
    } catch (e) {
        console.warn('⚠️ Failed to load .env:', e.message);
    }
}

// Master Key (Must be set in environment before running this, or we can prompt/error)
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

async function main() {
    console.log('🔒 [Alpha] Starting LibreChat Secure Launcher...');

    if (!fs.existsSync(SECURITY_PATH)) {
        console.error(`❌ Security package not found at: ${SECURITY_PATH}`);
        console.error('   Please run "npx turbo run build --filter=@alpha/security" from root.');
        process.exit(1);
    }

    if (!MASTER_KEY) {
        console.error('❌ ALPHA_MASTER_KEY environment variable is missing.');
        process.exit(1);
    }

    try {
        // Import the Security Package (compiled JS)
        const Security = require(SECURITY_PATH);
        console.log('📦 Loaded Security Package. Keys:', Object.keys(Security));

        const { VaultManager } = Security;
        if (!VaultManager) {
            throw new Error("VaultManager not found in Security package exports.");
        }

        // Decrypt Vault
        console.log('🔓 Decrypting Vault via VaultManager...');
        const vault = new VaultManager(MASTER_KEY, VALUES_PATH);

        // Get Secrets for LibreChat
        // We request 'librechat' scope + global scope
        const secrets = vault.getEnvForApp('librechat');

        // Inject Secrets
        const env = { ...process.env };
        let injectedCount = 0;

        for (const [key, value] of Object.entries(secrets)) {
            env[key] = value;
            injectedCount++;
        }

        console.log(`✅ Injected ${injectedCount} secrets into runtime environment.`);

        // Start LibreChat Backend
        // We bypass 'npm run backend' (which uses cross-env) because binaries might be missing on Windows.
        // Instead, we spawn 'node api/server/index.js' directly and set NODE_ENV manually.

        console.log('🚀 Spawning LibreChat Backend (Direct Node)...');

        // Ensure NODE_ENV is set
        env.NODE_ENV = 'production';

        const backend = spawn('node', ['api/server/index.js'], {
            cwd: path.resolve(__dirname, '..'), // Run from apps/librechat root
            env: env,
            stdio: 'inherit',
            shell: true
        });

        backend.on('close', (code) => {
            console.log(`[Alpha] LibreChat exited with code ${code}`);
            process.exit(code);
        });

    } catch (error) {
        console.error('❌ Failed to start securely:', error);
        process.exit(1);
    }
}

main();
