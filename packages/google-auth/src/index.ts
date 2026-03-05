/**
 * @alpha/google-auth — Shared Google OAuth2 for all Alpha sub-apps.
 * 
 * Dual-mode: reads credentials from env vars.
 * - Vault Mode:      run-with-secrets.js injects env vars from encrypted vault
 * - Standalone Mode: dotenv loads from .env.local
 * 
 * The googleapis library handles access token refresh automatically
 * when a valid refresh_token is provided.
 */

import { google, Auth } from 'googleapis';

// ── Combined scopes for all sub-apps ────────────────────────
export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',      // gmail-labeler, customer-responder
    'https://www.googleapis.com/auth/gmail.readonly',     // invoice-processor
    'https://www.googleapis.com/auth/drive.readonly',     // invoice-processor (read files)
    'https://www.googleapis.com/auth/drive.file',         // invoice-processor (upload files)
];

// ── Singleton auth client ───────────────────────────────────
let _authClient: Auth.OAuth2Client | null = null;

/**
 * Get a configured Google OAuth2 client.
 * 
 * Reads from environment variables (dual-mode compatible):
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET  
 * - GOOGLE_REFRESH_TOKEN
 * - GOOGLE_REDIRECT_URI (optional)
 * 
 * The client automatically refreshes access tokens using the refresh_token.
 * If the refresh token is revoked, API calls will throw an error.
 */
export function getGoogleAuth(): Auth.OAuth2Client {
    if (_authClient) return _authClient;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !refreshToken) {
        const missing = [];
        if (!clientId) missing.push('GOOGLE_CLIENT_ID');
        if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
        if (!refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
        throw new Error(
            `[google-auth] Missing credentials: ${missing.join(', ')}. ` +
            `Run "npx tsx scripts/alpha-auth.ts" to authorize, or check your .env.local`
        );
    }

    _authClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    _authClient.setCredentials({ refresh_token: refreshToken });

    return _authClient;
}

/**
 * Get a pre-configured Gmail API client.
 */
export function getGmail() {
    return google.gmail({ version: 'v1', auth: getGoogleAuth() });
}

/**
 * Get a pre-configured Google Drive API client.
 */
export function getDrive() {
    return google.drive({ version: 'v3', auth: getGoogleAuth() });
}

/**
 * Reset the cached auth client (for testing or re-initialization).
 */
export function resetGoogleAuth(): void {
    _authClient = null;
}

/**
 * Validate that the current refresh token is still valid.
 * Returns { valid: true, email } or { valid: false, error }.
 */
export async function validateGoogleAuth(): Promise<{
    valid: boolean;
    email?: string;
    error?: string;
}> {
    try {
        const auth = getGoogleAuth();
        const { credentials } = await auth.refreshAccessToken();
        if (credentials.access_token) {
            // Optionally fetch user email
            const gmail = google.gmail({ version: 'v1', auth });
            const profile = await gmail.users.getProfile({ userId: 'me' });
            return { valid: true, email: profile.data.emailAddress || undefined };
        }
        return { valid: false, error: 'No access token returned' };
    } catch (error: any) {
        const msg = error?.message || String(error);
        if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
            return {
                valid: false,
                error: 'Refresh token revoked. Run "npx tsx scripts/alpha-auth.ts" to re-authorize.'
            };
        }
        return { valid: false, error: msg };
    }
}
