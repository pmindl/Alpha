export interface CredentialMetadata {
    provider: string; // e.g., 'google', 'openai'
    service: string; // e.g., 'gmail', 'api'
    [key: string]: string | undefined;
}

export interface Credential {
    id: string; // Unique identifier, e.g., 'GOOGLE_CLIENT_ID'
    value: string; // The specific secret value
    description: string;
    scopes: string[]; // e.g., ['global', 'app:invoice-downloader']
    metadata: CredentialMetadata;
    updatedAt: string;
}

export interface EncryptedVault {
    iv: string; // Initialization Vector (hex)
    content: string; // Encrypted JSON string (hex)
    authTag: string; // Auth Tag (hex)
}

export interface VaultSchema {
    credentials: Credential[];
}
