/**
 * @alpha/google-auth — Shared Google OAuth2 for all Alpha sub-apps.
 */

import { google, Auth } from 'googleapis';

// ── Combined scopes for all sub-apps ────────────────────────
export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
];

// ── Singleton auth client ───────────────────────────────────
let _authClient: Auth.OAuth2Client | null = null;

export function getGoogleAuth(): Auth.OAuth2Client {
    if (_authClient) return _authClient;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

    console.log('[google-auth] Initializing new auth client...');
    console.log('[google-auth] Client ID starts with:', clientId?.substring(0, 10));
    console.log('[google-auth] Refresh Token starts with:', refreshToken?.substring(0, 10));

    if (!clientId || !clientSecret || !refreshToken) {
        const missing = [];
        if (!clientId) missing.push('GOOGLE_CLIENT_ID');
        if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
        if (!refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
        throw new Error(`[google-auth] Missing credentials: ${missing.join(', ')}`);
    }

    _authClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    _authClient.setCredentials({ refresh_token: refreshToken });

    return _authClient;
}

export function getGmail() {
    return google.gmail({ version: 'v1', auth: getGoogleAuth() });
}

export function getDrive() {
    return google.drive({ version: 'v3', auth: getGoogleAuth() });
}

export function resetGoogleAuth(): void {
    _authClient = null;
}

export async function validateGoogleAuth(): Promise<{
    valid: boolean;
    email?: string;
    error?: string;
}> {
    try {
        const auth = getGoogleAuth();
        console.log('[google-auth] Validating/Refreshing token...');
        const { credentials } = await auth.refreshAccessToken();
        if (credentials.access_token) {
            const gmail = google.gmail({ version: 'v1', auth });
            const profile = await gmail.users.getProfile({ userId: 'me' });
            return { valid: true, email: profile.data.emailAddress || undefined };
        }
        return { valid: false, error: 'No access token returned' };
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error('[google-auth] Validation Failed:', msg);
        return { valid: false, error: msg };
    }
}
