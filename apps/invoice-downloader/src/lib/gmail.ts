import { google } from 'googleapis';
import { EmailData, AttachmentMetadata } from './types';
import { oauth2Client } from './auth';

// Initialize Gmail API client
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export async function getProfile() {
    try {
        const res = await gmail.users.getProfile({ userId: 'me' });
        return res.data;
    } catch (e: any) {
        console.error('Error getting profile:', e.message);
        return null; // Return null on error so caller can handle
    }
}

/**
 * Lists messages matching a query.
 * Default query: 'label:INBOX -label:PROCESSED'
 */
export async function listMessages(query: string = 'label:INBOX -label:PROCESSED', maxResults: number = 10) {
    try {
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults,
        });
        return res.data.messages || [];
    } catch (error) {
        console.error('Error listing messages:', error);
        throw error;
    }
}

/**
 * Retrieves full message details.
 */
export async function getMessage(messageId: string): Promise<EmailData | null> {
    try {
        const res = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        const msg = res.data;
        if (!msg.payload) return null;

        const headers = msg.payload.headers;
        const subject = headers?.find((h) => h.name === 'Subject')?.value || '(No Subject)';
        const sender = headers?.find((h) => h.name === 'From')?.value || '(Unknown Sender)';
        const date = headers?.find((h) => h.name === 'Date')?.value || new Date().toISOString();

        let body = '';
        // Body extraction logic
        if (msg.payload.body?.data) {
            body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
        } else if (msg.payload.parts) {
            const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart?.body?.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            } else {
                const htmlPart = msg.payload.parts.find(p => p.mimeType === 'text/html');
                if (htmlPart?.body?.data) {
                    body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
                    body = body.replace(/<[^>]*>?/gm, '');
                }
            }
        }

        const snippet = msg.snippet || '';

        // Extract attachments
        const attachments: AttachmentMetadata[] = [];
        extractAttachments(msg.payload, attachments);

        return {
            id: msg.id || messageId,
            threadId: msg.threadId || '',
            subject,
            sender,
            date,
            body,
            snippet,
            attachments
        };
    } catch (error) {
        console.error(`Error getting message ${messageId}:`, error);
        return null;
    }
}

function extractAttachments(part: any, list: AttachmentMetadata[]) {
    if (part.filename && part.filename.length > 0 && part.body && part.body.attachmentId) {
        list.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0
        });
    }
    if (part.parts) {
        part.parts.forEach((p: any) => extractAttachments(p, list));
    }
}

export async function getAttachment(messageId: string, attachmentId: string) {
    const res = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId
    });
    return res.data; // contains .data (base64)
}

/**
 * Adds a label to a message. Creates the label if it doesn't exist.
 */
export async function addLabel(messageId: string, labelName: string) {
    try {
        // 1. Get all labels to find the ID of 'labelName'
        const res = await gmail.users.labels.list({ userId: 'me' });
        const labels = res.data.labels || [];
        let label = labels.find((l) => l.name === labelName);

        // 2. If label doesn't exist, create it
        if (!label) {
            console.log(`Label '${labelName}' not found. Creating it...`);
            const createRes = await gmail.users.labels.create({
                userId: 'me',
                requestBody: {
                    name: labelName,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show'
                }
            });
            label = createRes.data;
        }

        if (!label || !label.id) {
            throw new Error(`Failed to get or create label '${labelName}'`);
        }

        // 3. Apply label to message
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                addLabelIds: [label.id]
            }
        });

        console.log(`Added label '${labelName}' (ID: ${label.id}) to message ${messageId}`);

    } catch (error) {
        console.error(`Error adding label to message ${messageId}:`, error);
        // Don't throw, just log. Non-critical.
    }
}
