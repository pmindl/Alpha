import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { VaultManager } from '../packages/security/src/vault';

const PROJ_ROOT = path.resolve(__dirname, '..');
const VAULT_PATH = path.join(PROJ_ROOT, 'secrets/vault.encrypted.json');
const ENV_FILE = path.join(PROJ_ROOT, '.env');

// Load Master Key
dotenv.config({ path: ENV_FILE });
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

if (!MASTER_KEY) {
    console.error('❌ ALPHA_MASTER_KEY not found in .env');
    process.exit(1);
}

const vault = new VaultManager(MASTER_KEY, VAULT_PATH);

const CREDENTIALS_TO_IMPORT = [
    {
        path: 'apps/invoice-downloader/.env.local',
        appId: 'invoice-downloader',
        mappings: {
            'GEMINI_API_KEY': { scopes: ['global'], description: 'Deepmind Gemini API Key' },
            'GMAIL_CLIENT_ID': { scopes: ['app:invoice-downloader', 'app:invoice-processor'], description: 'Google OAuth Client ID' },
            'GMAIL_CLIENT_SECRET': { scopes: ['app:invoice-downloader', 'app:invoice-processor'], description: 'Google OAuth Secret' },
            'GMAIL_REFRESH_TOKEN': { scopes: ['app:invoice-downloader', 'app:invoice-processor'], description: 'Google OAuth Refresh Token' }
        }
    }
];

function main() {
    console.log('📦 Importing Credentials into Security Vault...');

    for (const item of CREDENTIALS_TO_IMPORT) {
        const envPath = path.join(PROJ_ROOT, item.path);
        if (!fs.existsSync(envPath)) {
            console.warn(`⚠️  Skipping ${item.path} (File not found)`);
            continue;
        }

        const envConfig = dotenv.parse(fs.readFileSync(envPath));

        for (const [key, config] of Object.entries(item.mappings)) {
            const value = envConfig[key];
            if (value) {
                vault.addCredential({
                    id: key,
                    value: value,
                    description: config.description,
                    scopes: config.scopes,
                    metadata: { provider: 'google', importedFrom: item.path },
                    updatedAt: new Date().toISOString()
                });
                console.log(`✅ Imported ${key} (Scopes: ${config.scopes.join(', ')})`);
            } else {
                console.warn(`❓ ${key} not found in ${item.path}`);
            }
        }
    }

    console.log('\n✨ Import Complete.');
}

main();
