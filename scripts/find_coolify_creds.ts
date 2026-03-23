
import { VaultManager } from './packages/security/src/vault';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const masterKey = process.env.ALPHA_MASTER_KEY;
const VAULT_PATH = path.resolve('secrets/vault.encrypted.json');

if (!masterKey) {
    console.error('Missing ALPHA_MASTER_KEY');
    process.exit(1);
}

const vault = new VaultManager(masterKey, VAULT_PATH);
const credentials = (vault as any).data.credentials; // Access private data for extraction

const coolifyCreds = credentials.filter(c => 
    c.id.toLowerCase().includes('coolify') || 
    c.id.toLowerCase().includes('vps') ||
    c.description?.toLowerCase().includes('coolify')
);

console.log('--- FOUND CREDENTIALS ---');
console.log(JSON.stringify(coolifyCreds.map(c => ({ id: c.id, value: c.value })), null, 2));

if (coolifyCreds.length === 0) {
    console.log('No explicit coolify keys found. All IDs:', credentials.map(c => c.id));
}
