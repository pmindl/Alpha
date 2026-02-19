import path from 'path';
import { VaultManager } from '@alpha/security';
import { ContextManager } from '@alpha/core';

// Paths
// Assuming process.cwd() is apps/master/
const PROJ_ROOT = path.resolve(process.cwd(), '../../');
const SECRETS_DIR = path.join(PROJ_ROOT, 'secrets');
const VAULT_PATH = path.join(SECRETS_DIR, 'vault.encrypted.json');
const CONTEXT_PATH = path.join(SECRETS_DIR, 'context.json');

// Keys
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;

// Singletons
let vaultManagerInstance: VaultManager | null = null;
let contextManagerInstance: ContextManager | null = null;

export function getVaultManager() {
    if (!vaultManagerInstance) {
        if (!MASTER_KEY) {
            console.warn('ALPHA_MASTER_KEY not found in environment. VaultManager will fail to decrypt.');
        }
        // Even if key is missing, we initialize. It might throw on load() if key is required for decryption.
        // VaultManager constructor takes (masterKey, vaultPath).
        console.log(`[Master] Initializing VaultManager from: ${VAULT_PATH}`);
        vaultManagerInstance = new VaultManager(MASTER_KEY || '', VAULT_PATH);
        console.log(`[Master] Vault loaded with ${vaultManagerInstance.listCredentials().length} credentials.`);
    }
    return vaultManagerInstance;
}

export function getContextManager() {
    if (!contextManagerInstance) {
        contextManagerInstance = new ContextManager(CONTEXT_PATH);
    }
    return contextManagerInstance;
}
