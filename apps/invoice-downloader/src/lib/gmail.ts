import { google } from 'googleapis';
import { validateGoogleAuth, getGoogleAuth } from '@alpha/google-auth';
import { uploadFile } from './gdrive';
import { detectCompany, getCompanies } from './companies';

async function getGmailClient() {
    const auth = getGoogleAuth();
    const { token } = await auth.getAccessToken();
    if (!token) {
        throw new Error('Failed to obtain Google access token');
    }
    return google.gmail({ version: 'v1', auth });
}

export async function getProfile() {
    const gmail = await getGmailClient();
    const res = await gmail.users.getProfile({ userId: 'me' });
    return res.data;
}

export async function listMessages(query: string, limit: number = 10) {
    const gmail = await getGmailClient();
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: limit,
    });
    return res.data.messages || [];
}

export async function getMessage(id: string) {
    const gmail = await getGmailClient();
    const res = await gmail.users.messages.get({
        userId: 'me',
        id,
    });

    const payload = res.data.payload;
    const headers = payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    // Extract attachments metadata
    const attachments = [];
    const parts = payload?.parts || [];

    // Recursive search for attachments in nested parts
    function findAttachments(parts: any[]) {
        for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    id: part.body.attachmentId,
                    filename: part.filename,
                    mimeType: part.mimeType,
                });
            }
            if (part.parts) findAttachments(part.parts);
        }
    }
    findAttachments(parts);

    return {
        id: res.data.id,
        subject,
        sender: from,
        date: new Date(date).toISOString(),
        attachments,
        body: payload?.body?.data ? Buffer.from(payload.body.data, 'base64').toString() : '',
    };
}

export async function getAttachment(messageId: string, attachmentId: string) {
    const gmail = await getGmailClient();
    const res = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
    });
    return res.data;
}

export async function addLabel(messageId: string, labelName: string) {
    const gmail = await getGmailClient();

    // First find label ID
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    let labelId = labelsRes.data.labels?.find(l => l.name === labelName)?.id;

    if (!labelId) {
        // Create label if not exists
        const createRes = await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
                name: labelName,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show',
            },
        });
        labelId = createRes.data.id;
    }

    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
            addLabelIds: [labelId],
            removeLabelIds: ['UNREAD'],
        },
    });
}

/**
 * Main ingestion loop used by the API endpoint.
 */
export async function checkEmails() {
    console.log('[Downloader] checkEmails triggered');
    const label = process.env.GMAIL_LABEL || 'INBOX';
    const query = `label:${label} is:unread has:attachment`;

    const messages = await listMessages(query, 10);
    const processed = [];

    for (const msgRef of messages) {
        if (!msgRef.id) continue;
        const msg = await getMessage(msgRef.id);

        const companyId = detectCompany(msg.sender + ' ' + msg.subject);
        let company = getCompanies().find(c => c.id === companyId);

        if (!company) {
            company = getCompanies().find(c => !!c.gdriveFolderId);
            if (!company) continue;
        }

        for (const attach of msg.attachments) {
            const data = await getAttachment(msgRef.id, attach.id);
            if (data.data) {
                const buffer = Buffer.from(data.data, 'base64');
                const folderId = company?.gdriveFolderId || process.env.COMPANY_FIRMA_A_GDRIVE_FOLDER || '';
                if (folderId) {
                    await uploadFile(attach.filename, attach.mimeType, buffer, folderId);
                    processed.push({ emailId: msgRef.id, file: attach.filename, company: company?.id || 'unknown' });
                } else {
                    console.error('[Gmail] No GDrive folder ID available for upload');
                }
            }
        }

        if (process.env.GMAIL_MARK_READ === 'true') {
            await addLabel(msgRef.id, 'PROCESSED');
        }
    }

    return processed;
}
