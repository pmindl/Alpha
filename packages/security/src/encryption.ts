import crypto from 'crypto';
import { EncryptedVault } from './types';

const ALGORITHM = 'aes-256-gcm';

export class Encryption {
    private key: Buffer;

    constructor(masterKeyHex: string) {
        if (!masterKeyHex || masterKeyHex.length !== 64) {
            throw new Error('Master key must be a 64-character hex string (32 bytes).');
        }
        this.key = Buffer.from(masterKeyHex, 'hex');
    }

    encrypt(text: string): EncryptedVault {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            iv: iv.toString('hex'),
            content: encrypted,
            authTag: authTag.toString('hex')
        };
    }

    decrypt(data: EncryptedVault): string {
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            this.key,
            Buffer.from(data.iv, 'hex')
        );

        decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

        let decrypted = decipher.update(data.content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    static generateMasterKey(): string {
        return crypto.randomBytes(32).toString('hex');
    }
}
