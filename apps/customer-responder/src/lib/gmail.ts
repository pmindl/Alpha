
import { google } from 'googleapis';
import path from 'path';
import { VaultManager, CredentialManager } from '@alpha/security';

let auth: any;
let gmail: any;

function getAuth() {
    if (auth) return auth;

    // Smart Credential Loading
    const masterKey = process.env.ALPHA_MASTER_KEY;
    if (masterKey) {
        console.log("🔐 [Gmail] Using Smart Credential Manager (Auto-Refresh Enabled)");
        try {
            // Resolve vault path relative to app root (Alpha/apps/customer-responder -> Alpha/secrets)
            const vaultPath = path.resolve(process.cwd(), '../../secrets/vault.encrypted.json');

            const vault = new VaultManager(masterKey, vaultPath);
            const credManager = new CredentialManager(vault);

            auth = credManager.getGoogleClient(
                'GOOGLE_CLIENT_ID',
                'GOOGLE_CLIENT_SECRET',
                'GOOGLE_REFRESH_TOKEN',
                process.env.GOOGLE_REDIRECT_URI
            );

        } catch (e) {
            console.error("⚠️ [Gmail] Failed to initialize Smart Credential Manager:", e);
            console.warn("⚠️ [Gmail] Falling back to standard environment variables");
        }
    }

    // Fallback to standard environment variables if Vault/Smart failed or key missing
    if (!auth) {
        console.log("📄 [Gmail] Using Standard Environment Variables");
        auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });
    }

    return auth;
}

export function getGmailClient() {
    if (gmail) return gmail;
    const authClient = getAuth();
    gmail = google.gmail({ version: 'v1', auth: authClient });
    return gmail;
}

export async function listUnreadEmails(days: number = 14, maxResults: number = 10) {
    const client = getGmailClient();
    try {
        const query = `is:unread label:INBOX newer_than:${days}d`;
        console.log(`🔍 [Gmail] Listing unread emails (Query: "${query}", Limit: ${maxResults})`);

        const res = await client.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: maxResults
        });

        if (!res.data.messages || res.data.messages.length === 0) {
            return [];
        }

        const emails = [];
        for (const message of res.data.messages) {
            const msg = await client.users.messages.get({
                userId: 'me',
                id: message.id!
            });

            const headers = msg.data.payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers?.find(h => h.name === 'From')?.value || '(Unknown)';
            const snippet = msg.data.snippet;

            emails.push({
                id: message.id!,
                threadId: msg.data.threadId!,
                subject,
                from,
                snippet
            });
        }
        return emails;
    } catch (error) {
        console.error("❌ Error listing unread emails:", error);
        return [];
    }
}

export async function createDraft(threadId: string, to: string, subject: string, body: string) {
    const client = getGmailClient();
    try {
        // Construct email message
        const messageParts = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset="UTF-8"',
            'MIME-Version: 1.0',
            '',
            body
        ];
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await client.users.drafts.create({
            userId: 'me',
            requestBody: {
                message: {
                    raw: encodedMessage,
                    threadId: threadId // Reply to thread
                }
            }
        });
        console.log(`📝 Draft created for thread ${threadId}`);
        return true;
    } catch (error) {
        console.error('❌ Error creating draft:', error);
        return false;
    }
}
