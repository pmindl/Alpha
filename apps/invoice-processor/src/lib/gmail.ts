import { google } from 'googleapis';
import { uploadFile } from './gdrive';
import { detectCompany, getCompanies } from './companies';

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth });

export async function checkEmails() {
    const label = process.env.GMAIL_LABEL || 'INBOX';
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: `label:${label} is:unread has:attachment`,
    });

    const messages = res.data.messages || [];
    const processed = [];

    for (const msg of messages) {
        if (!msg.id) continue;

        // Get full message details
        const message = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
        });

        const headers = message.data.payload?.headers;
        const subject = headers?.find(h => h.name === 'Subject')?.value || '';
        const from = headers?.find(h => h.name === 'From')?.value || '';

        // Detect company
        const companyId = detectCompany(from + ' ' + subject);
        const company = getCompanies().find(c => c.id === companyId);

        if (!company) {
            console.log(`Skipping email ${msg.id}: No company detected`);
            continue;
        }

        // Process attachments
        const parts = message.data.payload?.parts || [];
        for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
                const attach = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId: msg.id,
                    id: part.body.attachmentId,
                });

                if (attach.data.data) {
                    const buffer = Buffer.from(attach.data.data, 'base64');
                    await uploadFile(part.filename, part.mimeType || 'application/octet-stream', buffer, company.gdriveFolderId);
                    processed.push({ emailId: msg.id, file: part.filename, company: company.id });
                }
            }
        }

        // Mark as read
        if (process.env.GMAIL_MARK_READ === 'true') {
            await gmail.users.messages.modify({
                userId: 'me',
                id: msg.id,
                requestBody: {
                    removeLabelIds: ['UNREAD'],
                },
            });
        }
    }

    return processed;
}
