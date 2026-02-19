import path from 'path';
import dotenv from 'dotenv';
import { VaultManager } from '../packages/security/src';

const PROJ_ROOT = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(PROJ_ROOT, 'secrets');
const VAULT_PATH = path.join(SECRETS_DIR, 'vault.encrypted.json');

dotenv.config({ path: path.join(PROJ_ROOT, '.env') });
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

if (!MASTER_KEY) {
    console.error("Missing ALPHA_MASTER_KEY");
    process.exit(1);
}

try {
    const vault = new VaultManager(MASTER_KEY, VAULT_PATH);
    const creds = vault.listCredentials();
    console.log(`Vault at ${VAULT_PATH} contains ${creds.length} credentials:`);
    creds.forEach(c => console.log(` - ${c.id} (${c.scopes.join(', ')})`));
} catch (e) {
    console.error("Failed to read vault:", e);
}
