import fs from 'fs';
import path from 'path';
import { Encryption } from '../packages/security/src/encryption';
import { VaultManager } from '../packages/security/src/vault';

const PROJ_ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(PROJ_ROOT, 'secrets');
const VAULT_PATH = path.join(SECRETS_DIR, 'vault.encrypted.json');
const ENV_FILE = path.join(PROJ_ROOT, '.env');

async function main() {
    console.log('🔐 Setting up Project Alpha Security Vault...');

    if (!fs.existsSync(SECRETS_DIR)) {
        fs.mkdirSync(SECRETS_DIR);
        console.log('✅ Created secrets directory.');
    }

    // 1. Generate Master Key
    let masterKey = '';
    if (fs.existsSync(ENV_FILE)) {
        const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
        const match = envContent.match(/ALPHA_MASTER_KEY=([a-f0-9]{64})/);
        if (match) {
            masterKey = match[1];
            console.log('ℹ️ Found existing Master Key in .env');
        }
    }

    if (!masterKey) {
        masterKey = Encryption.generateMasterKey();
        console.log('🔑 Generated NEW Master Key.');

        // Append to .env
        fs.appendFileSync(ENV_FILE, `\nALPHA_MASTER_KEY=${masterKey}\n`);
        console.log('✅ Saved Master Key to .env');
    }

    // 2. Initialize Vault
    if (!fs.existsSync(VAULT_PATH)) {
        const vault = new VaultManager(masterKey, VAULT_PATH);
        vault.save();
        console.log(`✅ Created empty vault at ${VAULT_PATH}`);
    } else {
        console.log('ℹ️ Vault already exists.');
    }

    console.log('\n🎉 Security Vault Setup Complete!');
    console.log('Master Key is stored in .env (DO NOT COMMIT THIS FILE).');
}

main().catch(console.error);
