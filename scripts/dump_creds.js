
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ALPHA_MASTER_KEY;
const VAULT_PATH = path.join(process.cwd(), 'secrets', 'vault.encrypted.json');

if (!MASTER_KEY) {
    console.error('ALPHA_MASTER_KEY not found in .env');
    process.exit(1);
}

if (!fs.existsSync(VAULT_PATH)) {
    console.error('Vault file not found at:', VAULT_PATH);
    process.exit(1);
}

try {
    const key = Buffer.from(MASTER_KEY, 'hex');
    const encryptedData = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf-8'));

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const vault = JSON.parse(decrypted);
    const credentials = vault.credentials;

    const coolifyCreds = credentials.filter(c => 
        c.id.toLowerCase().includes('coolify') || 
        c.id.toLowerCase().includes('vps') ||
        (c.description && c.description.toLowerCase().includes('coolify'))
    );

    console.log('--- FOUND POTENTIAL COOLIFY CREDENTIALS ---');
    console.log(JSON.stringify(coolifyCreds.map(c => ({ id: c.id, description: c.description, value: c.value })), null, 2));

    if (coolifyCreds.length === 0) {
        console.log('No coolify-related keys found. Available IDs:');
        console.log(credentials.map(c => c.id).join(', '));
    }

} catch (error) {
    console.error('Error decrypting vault:', error.message);
}
