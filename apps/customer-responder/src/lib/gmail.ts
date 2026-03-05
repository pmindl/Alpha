import { google } from 'googleapis';
import { constructRawEmail } from './email-utils';
import { logErrorSafely } from './logger';
import { getGmail } from '@alpha/google-auth';

// Lazy initialization — don't call getGmail() at import time
function getGmailClient() {
    return getGmail();
}

// Label constants matching gmail-labeler taxonomy
export const LABELS = {
    ACTION_PREPARE_REPLY: 'ACTION/Prepare-reply',
    STATUS_NEW: 'STATUS/New',
    STATUS_PROCESSED: 'STATUS/Processed',
    DRAFT_COMPOSED: 'DRAFT/Composed',
    DRAFT_FAILED: 'DRAFT/Failed',
    DRAFT_LOW_CONFIDENCE: 'DRAFT/Low-Confidence',
} as const;

export interface EmailLabels {
    type: string | null;
    priority: string | null;
    action: string | null;
    status: string | null;
    finance: string | null;
}

export interface EmailMessage {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    snippet: string;
    body: string;
    date: string;
    labels: EmailLabels;
}

/**
 * Cache for label name ↔ ID mapping.
 */
let labelMapCache: Record<string, string> | null = null;

async function getLabelMap(): Promise<Record<string, string>> {
    if (!labelMapCache) {
        const res = await getGmailClient().users.labels.list({ userId: 'me' });
        labelMapCache = {};
        for (const label of res.data.labels || []) {
            if (label.name && label.id) {
                labelMapCache[label.name] = label.id;
            }
        }
    }
    return labelMapCache;
}

/**
 * Ensure our custom DRAFT labels exist in Gmail.
 */
export async function ensureDraftLabelsExist(): Promise<void> {
    try {
        const labelMap = await getLabelMap();
        const draftLabels = [LABELS.DRAFT_COMPOSED, LABELS.DRAFT_FAILED, LABELS.DRAFT_LOW_CONFIDENCE];

        for (const labelName of draftLabels) {
            if (!labelMap[labelName]) {
                try {
                    const created = await getGmailClient().users.labels.create({
                        userId: 'me',
                        requestBody: {
                            name: labelName,
                            labelListVisibility: 'labelShow',
                            messageListVisibility: 'show',
                        },
                    });
                    if (created.data.id) {
                        labelMap[labelName] = created.data.id;
                    }
                    console.log(`✅ Created label: ${labelName}`);
                } catch (e) {
                    console.warn(`⚠️ Could not create label ${labelName}:`, e);
                }
            }
        }
    } catch (error) {
        logErrorSafely('Error ensuring DRAFT labels exist', error);
    }
}

/**
 * Extract taxonomy labels from a thread's messages.
 */
function extractLabelsFromThread(messages: any[], labelMap: Record<string, string>): EmailLabels {
    const idToName: Record<string, string> = {};
    for (const [name, id] of Object.entries(labelMap)) {
        idToName[id] = name;
    }

    // Collect all label IDs from all messages in the thread
    const allLabelIds = new Set<string>();
    for (const msg of messages) {
        for (const lid of msg.labelIds || []) {
            allLabelIds.add(lid);
        }
    }

    const result: EmailLabels = {
        type: null,
        priority: null,
        action: null,
        status: null,
        finance: null,
    };

    for (const lid of Array.from(allLabelIds)) {
        const name = idToName[lid];
        if (!name) continue;

        if (name.startsWith('TYPE/')) result.type = name.replace('TYPE/', '');
        else if (name.startsWith('PRIORITY/')) result.priority = name.replace('PRIORITY/', '');
        else if (name.startsWith('ACTION/')) result.action = name.replace('ACTION/', '');
        else if (name.startsWith('STATUS/')) result.status = name.replace('STATUS/', '');
        else if (name.startsWith('FINANCE/')) result.finance = name.replace('FINANCE/', '');
    }

    return result;
}

/**
 * List emails that are ready for draft composition.
 * Filters by ACTION/Prepare-reply label and excludes already-processed threads.
 */
export async function listEmailsForDrafting(): Promise<EmailMessage[]> {
    try {
        const labelMap = await getLabelMap();

        // Check if the required label exists
        const prepareReplyLabelId = labelMap[LABELS.ACTION_PREPARE_REPLY];
        const draftComposedLabelId = labelMap[LABELS.DRAFT_COMPOSED];

        // Build query: must have Prepare-reply action, must NOT have DRAFT/Composed
        let query = `is:unread`;
        if (prepareReplyLabelId) {
            query = `label:${LABELS.ACTION_PREPARE_REPLY.replace('/', '-')} is:unread`;
            // Also exclude already-composed drafts
            if (draftComposedLabelId) {
                query += ` -label:${LABELS.DRAFT_COMPOSED.replace('/', '-')}`;
            }
        } else {
            // Fallback: if labeler hasn't run yet, use basic inbox query
            console.warn('⚠️ ACTION/Prepare-reply label not found. Falling back to unread inbox.');
            query = 'label:INBOX is:unread';
        }

        const res = await getGmailClient().users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 10,
        });

        const messages = res.data.messages || [];
        const emails: EmailMessage[] = [];

        for (const msg of messages) {
            if (!msg.id) continue;

            // Get thread details to access labels and all messages
            const thread = await getGmailClient().users.threads.get({
                userId: 'me',
                id: msg.threadId || msg.id,
                format: 'full',
            });

            const threadMessages = thread.data.messages || [];
            const lastMessage = threadMessages[threadMessages.length - 1];
            if (!lastMessage) continue;

            const headers = lastMessage.payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers?.find(h => h.name === 'From')?.value || '(Unknown)';
            const date = headers?.find(h => h.name === 'Date')?.value || '';
            const snippet = lastMessage.snippet || '';

            // Extract body
            let body = snippet;
            if (lastMessage.payload?.body?.data) {
                body = Buffer.from(lastMessage.payload.body.data, 'base64').toString('utf-8');
            } else if (lastMessage.payload?.parts) {
                const textPart = lastMessage.payload.parts.find(p => p.mimeType === 'text/plain');
                if (textPart && textPart.body?.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
            }

            // Extract labels from the thread
            const labels = extractLabelsFromThread(threadMessages, labelMap);

            emails.push({
                id: msg.id,
                threadId: thread.data.id!,
                subject,
                from,
                snippet,
                body,
                date,
                labels,
            });
        }

        return emails;
    } catch (error) {
        logErrorSafely('Error listing emails for drafting', error);
        return [];
    }
}

/**
 * Legacy function — kept for backward compatibility and MCP tool.
 */
export async function listUnreadEmails(label: string = 'INBOX'): Promise<EmailMessage[]> {
    try {
        const res = await getGmailClient().users.messages.list({
            userId: 'me',
            q: `label:${label} is:unread`,
            maxResults: 10
        });

        const messages = res.data.messages || [];
        const emails: EmailMessage[] = [];

        for (const msg of messages) {
            if (!msg.id) continue;

            const message = await getGmailClient().users.messages.get({
                userId: 'me',
                id: msg.id,
            });

            const headers = message.data.payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers?.find(h => h.name === 'From')?.value || '(Unknown)';
            const date = headers?.find(h => h.name === 'Date')?.value || '';
            const snippet = message.data.snippet || '';

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
                date,
                labels: { type: null, priority: null, action: null, status: null, finance: null },
            });
        }

        return emails;
    } catch (error) {
        logErrorSafely('Error listing emails', error);
        return [];
    }
}

/**
 * Create a Gmail draft reply in the specified thread.
 */
export async function createDraft(threadId: string, to: string, subject: string, body: string) {
    try {
        const message = constructRawEmail(to, subject, body);
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await getGmailClient().users.drafts.create({
            userId: 'me',
            requestBody: {
                message: {
                    raw: encodedMessage,
                    threadId: threadId
                }
            }
        });
        console.log(`📝 Draft created for thread ${threadId}`);
        return true;
    } catch (error) {
        logErrorSafely('Error creating draft', error);
        return false;
    }
}

/**
 * Apply feedback labels to a thread after processing.
 */
export async function applyFeedbackLabels(
    threadId: string,
    options: { success: boolean; lowConfidence?: boolean }
): Promise<void> {
    try {
        const labelMap = await getLabelMap();
        const addLabels: string[] = [];
        const removeLabels: string[] = [];

        if (options.success) {
            // Add DRAFT/Composed
            if (labelMap[LABELS.DRAFT_COMPOSED]) {
                addLabels.push(labelMap[LABELS.DRAFT_COMPOSED]);
            }
            // Change STATUS/New → STATUS/Processed
            if (labelMap[LABELS.STATUS_NEW]) {
                removeLabels.push(labelMap[LABELS.STATUS_NEW]);
            }
            if (labelMap[LABELS.STATUS_PROCESSED]) {
                addLabels.push(labelMap[LABELS.STATUS_PROCESSED]);
            }
            // Low confidence flag
            if (options.lowConfidence && labelMap[LABELS.DRAFT_LOW_CONFIDENCE]) {
                addLabels.push(labelMap[LABELS.DRAFT_LOW_CONFIDENCE]);
            }
        } else {
            // Draft creation failed
            if (labelMap[LABELS.DRAFT_FAILED]) {
                addLabels.push(labelMap[LABELS.DRAFT_FAILED]);
            }
        }

        if (addLabels.length > 0 || removeLabels.length > 0) {
            await getGmailClient().users.threads.modify({
                userId: 'me',
                id: threadId,
                requestBody: {
                    addLabelIds: addLabels,
                    removeLabelIds: removeLabels,
                },
            });
        }
    } catch (error) {
        logErrorSafely('Error applying feedback labels', error);
    }
}
