import { google } from 'googleapis';

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth });

export interface EmailMessage {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    snippet: string;
    body: string;
    date: string;
}

export async function listUnreadEmails(label: string = 'INBOX'): Promise<EmailMessage[]> {
    try {
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: `label:${label} is:unread`,
            maxResults: 10
        });

        const messages = res.data.messages || [];
        const emails: EmailMessage[] = [];

        for (const msg of messages) {
            if (!msg.id) continue;

            const message = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
            });

            const headers = message.data.payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers?.find(h => h.name === 'From')?.value || '(Unknown)';
            const date = headers?.find(h => h.name === 'Date')?.value || '';
            const snippet = message.data.snippet || '';

            // Extract body (simple logic for now)
            let body = snippet;
            if (message.data.payload?.body?.data) {
                body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
            } else if (message.data.payload?.parts) {
                const textPart = message.data.payload.parts.find(p => p.mimeType === 'text/plain');
                if (textPart && textPart.body?.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
            }

            emails.push({
                id: msg.id,
                threadId: message.data.threadId!,
                subject,
                from,
                snippet,
                body,
                date
            });
        }

        return emails;
    } catch (error) {
        console.error('❌ Error listing emails:', error);
        return [];
    }
}

export async function createDraft(threadId: string, to: string, subject: string, body: string) {
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

        await gmail.users.drafts.create({
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
