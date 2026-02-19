import fs from 'fs';
import path from 'path';
import { Encryption } from './encryption';
import { Credential, EncryptedVault, VaultSchema } from './types';

export class VaultManager {
    private encryption: Encryption;
    private vaultPath: string;
    private data: VaultSchema;

    constructor(masterKey: string, vaultPath: string) {
        this.encryption = new Encryption(masterKey);
        this.vaultPath = vaultPath;
        this.data = this.load();
    }

    private load(): VaultSchema {
        if (!fs.existsSync(this.vaultPath)) {
            return { credentials: [] };
        }

        try {
            const fileContent = fs.readFileSync(this.vaultPath, 'utf-8');
            const encryptedData: EncryptedVault = JSON.parse(fileContent);
            const decryptedString = this.encryption.decrypt(encryptedData);
            return JSON.parse(decryptedString);
        } catch (error) {
            throw new Error(`Failed to load or decrypt vault at ${this.vaultPath}: ${error}`);
        }
    }

    public save(): void {
        const jsonString = JSON.stringify(this.data);
        const encryptedData = this.encryption.encrypt(jsonString);
        fs.mkdirSync(path.dirname(this.vaultPath), { recursive: true });
        fs.writeFileSync(this.vaultPath, JSON.stringify(encryptedData, null, 2));
    }

    public addCredential(credential: Credential): void {
        const index = this.data.credentials.findIndex(c => c.id === credential.id);
        if (index >= 0) {
            this.data.credentials[index] = credential;
        } else {
            this.data.credentials.push(credential);
        }
        this.save();
    }

    public updateCredentialValue(id: string, value: string): void {
        const credential = this.data.credentials.find(c => c.id === id);
        if (credential) {
            credential.value = value;
            credential.updatedAt = new Date().toISOString();
            this.save();
        }
    }

    public getCredential(id: string): Credential | undefined {
        return this.data.credentials.find(c => c.id === id);
    }

    public removeCredential(id: string): boolean {
        const initialLength = this.data.credentials.length;
        this.data.credentials = this.data.credentials.filter(c => c.id !== id);
        if (this.data.credentials.length !== initialLength) {
            this.save();
            return true;
        }
        return false;
    }

    public listCredentials(): Omit<Credential, 'value'>[] {
        return this.data.credentials.map(({ value, ...rest }) => rest);
    }

    public getEnvForApp(appId: string): Record<string, string> {
        const env: Record<string, string> = {};
        const relevantCredentials = this.data.credentials.filter(c =>
            c.scopes.includes('global') || c.scopes.includes(`app:${appId}`)
        );

        for (const cred of relevantCredentials) {
            env[cred.id] = cred.value;
        }
        return env;
    }
}
