import { OAuth2Client } from 'google-auth-library';
import { VaultManager } from './vault';

export class CredentialManager {
    private vault: VaultManager;

    constructor(vault: VaultManager) {
        this.vault = vault;
    }

    /**
     * Creates a Google OAuth2Client that automatically persists token updates to the Vault.
     * 
     * @param clientIdCredId ID of the credential storing the Client ID
     * @param clientSecretCredId ID of the credential storing the Client Secret
     * @param refreshTokenCredId ID of the credential storing the Refresh Token
     * @param redirectUri (Optional) Redirect URI
     */
    public getGoogleClient(
        clientIdCredId: string,
        clientSecretCredId: string,
        refreshTokenCredId: string,
        redirectUri?: string
    ): OAuth2Client {
        const clientId = this.vault.getCredential(clientIdCredId)?.value;
        const clientSecret = this.vault.getCredential(clientSecretCredId)?.value;
        const refreshToken = this.vault.getCredential(refreshTokenCredId)?.value;

        if (!clientId || !clientSecret) {
            throw new Error(`Missing Google Credentials: ${clientIdCredId} or ${clientSecretCredId}`);
        }

        const client = new OAuth2Client(clientId, clientSecret, redirectUri);

        if (refreshToken) {
            client.setCredentials({ refresh_token: refreshToken });
        }

        // Reactive Persistence: Listen for token updates
        client.on('tokens', (tokens) => {
            console.log('🔄 [CredentialManager] Received new tokens from Google');

            if (tokens.refresh_token) {
                console.log('💾 [CredentialManager] Saving new REFRESH_TOKEN to Vault');
                this.vault.updateCredentialValue(refreshTokenCredId, tokens.refresh_token);
            }

            if (tokens.access_token) {
                // We could store access token if we wanted a cache, but usually overkill for this simple setup
                // this.vault.updateCredentialValue('GOOGLE_ACCESS_TOKEN', tokens.access_token);
            }
        });

        return client;
    }
}
