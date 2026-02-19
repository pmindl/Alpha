
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { VaultManager } from '@alpha/security';

// Load .env.local DIRECTLY to avoid process.env pollution from run-with-secrets
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = dotenv.parse(envContent);

async function syncToVault() {
    console.log("🔐 Starting Vault Sync...");

    // Master key still needs to come from process.env (injected by run-with-secrets)
    const masterKey = process.env.ALPHA_MASTER_KEY;
    if (!masterKey) {
        console.error("❌ ALPHA_MASTER_KEY is missing! Run this script with run-with-secrets.js");
        process.exit(1);
    }

    const vaultPath = path.resolve(process.cwd(), '../../secrets/vault.encrypted.json');
    const vault = new VaultManager(masterKey, vaultPath);

    const keysToSync = [
        'GOOGLE_REFRESH_TOKEN',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI'
    ];

    for (const key of keysToSync) {
        // Use value from the file, NOT process.env
        const value = envConfig[key];
        if (!value) {
            console.warn(`⚠️  ${key} missing from .env.local - skipping.`);
            continue;
        }

        console.log(`🔑 Syncing ${key}...`);

        // Check if exists
        const existing = vault.getCredential(key);

        if (existing) {
            if (existing.value !== value) {
                vault.updateCredentialValue(key, value);
                console.log(`✅ Updated ${key} in Alpha Vault`);
            } else {
                console.log(`✅ Vault already has correct ${key}.`);
            }
        } else {
            vault.addCredential({
                id: key,
                value: value,
                description: `Synced from .env.local: ${key}`,
                scopes: ['global'],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'google', service: 'gmail', key }
            });
            console.log(`✅ Added new ${key} to Alpha Vault`);
        }
    }
}

syncToVault().catch(console.error);
