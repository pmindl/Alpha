import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { VaultManager } from '../packages/security/src';

const PROJ_ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(PROJ_ROOT, 'secrets');
const VAULT_PATH = path.join(SECRETS_DIR, 'vault.encrypted.json');

// Need master key from root .env
dotenv.config({ path: path.join(PROJ_ROOT, '.env') });
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

if (!MASTER_KEY) {
    console.error("Missing ALPHA_MASTER_KEY in root .env");
    process.exit(1);
}

const vault = new VaultManager(MASTER_KEY, VAULT_PATH);

// Helper to migrate a file
function migrateFile(filePath: string, scope: string, provider: string, service: string) {
    if (!fs.existsSync(filePath)) return;

    console.log(`Migrating ${filePath}...`);
    const content = fs.readFileSync(filePath);
    const parsed = dotenv.parse(content);

    for (const [key, value] of Object.entries(parsed)) {
        console.log(`  - ${key}`);
        vault.addCredential({
            id: key,
            value: value,
            scopes: [scope, 'global'], // Add global for visibility in master
            description: `Imported from ${path.basename(filePath)}`,
            metadata: { provider, service },
            updatedAt: new Date().toISOString()
        });
    }
}

// 1. Customer Responder
migrateFile(
    path.join(PROJ_ROOT, 'apps/customer-responder/.env.local'),
    'app:customer-responder',
    'manual',
    'customer-responder'
);

// 2. Invoice Processor
migrateFile(
    path.join(PROJ_ROOT, 'apps/invoice-processor/.env'),
    'app:invoice-processor',
    'manual',
    'invoice-processor'
);

console.log("Migration complete!");
