import { listMessages, getMessage, getAttachment, addLabel, getProfile } from './gmail';
import { analyzeEmail, analyzeDocument } from './ai';
import { uploadFile } from './gdrive';
import { downloadFile } from './downloader';
import { detectCompany, getCompanies } from './companies';
import { sanitizeFilename } from './utils';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const PRIORITIZED_KEYWORDS = ['faktura', 'invoice', 'doklad', 'účtenka', 'billing', 'dobropis', 'platba', 'tax', 'vat', 'payment', 'receipt'];

const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/xml',
    'application/xml',
    'text/plain'
];

function containsKeyword(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
}

function logDecision(emailId: string, filename: string, decision: 'UPLOAD' | 'SKIP', reason: string) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        emailId,
        filename,
        decision,
        reason
    };

    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(path.join(logDir, 'processing_decisions.json'), JSON.stringify(logEntry) + '\n');
}

export interface ProcessingResult {
    success: boolean;
    processedCount: number;
    results: any[];
    fullLogs: string[];
    error?: string;
}

export async function processSingleEmail(msgId: string): Promise<{ success: boolean, log: string[], result: any }> {
    const logs: string[] = [];
    const processedFiles: any[] = [];

    try {
        const email = await getMessage(msgId);
        if (!email) {
            logs.push(`Could not fetch details for message ${msgId}`);
            return { success: false, log: logs, result: null };
        }

        logs.push(`Analyzing: ${email.subject} (${email.id})`);

        const attachmentNames = email.attachments.map(a => a.filename);
        const subjectHasKeyword = containsKeyword(email.subject, PRIORITIZED_KEYWORDS);
        const attachmentsHaveKeyword = attachmentNames.some(name => containsKeyword(name, PRIORITIZED_KEYWORDS));
        const isStrongSignal = subjectHasKeyword || attachmentsHaveKeyword;

        // AI Analysis
        const metadata = await analyzeEmail(email.subject, email.body, email.sender, attachmentNames);

        // Decision logic
        let shouldProcess = metadata.is_invoice || isStrongSignal;
        let reason = metadata.is_invoice ? 'AI Confirmed' : 'Keyword Fallback';

        if (shouldProcess) {
            logs.push(`Decision: PROCESS (${reason})`);

            // Company detection
            const companyId = detectCompany(email.sender + ' ' + email.subject + ' ' + attachmentNames.join(' '));
            const company = getCompanies().find(c => c.id === companyId) || getCompanies().find(c => !!c.gdriveFolderId);
            const folderId = company?.gdriveFolderId || process.env.COMPANY_FIRMA_A_GDRIVE_FOLDER || '';

            if (!folderId) {
                logs.push('Error: No GDrive folder ID available.');
                return { success: false, log: logs, result: null };
            }

            // 1. Process Attachments
            if (email.attachments.length > 0) {
                for (const attach of email.attachments) {
                    const isSupported = SUPPORTED_MIME_TYPES.some(t => attach.mimeType.includes(t)) ||
                        /\.(pdf|jpg|jpeg|png|xml)$/i.test(attach.filename);

                    if (!isSupported) continue;

                    const data = await getAttachment(email.id, attach.id);
                    if (data.data) {
                        const buffer = Buffer.from(data.data, 'base64');
                        const safeDate = email.date.split('T')[0];
                        const finalName = sanitizeFilename(`${safeDate}_${attach.filename}`);

                        const upload = await uploadFile(finalName, attach.mimeType, buffer, folderId);
                        logs.push(`Uploaded: ${finalName}`);
                        processedFiles.push({ name: finalName, id: upload.fileId, link: upload.webViewLink });
                    }
                }
            }

            // 2. Process Link if no attachments or requested
            if (metadata.content_type === 'link' && metadata.invoice_url) {
                logs.push(`Downloading from URL: ${metadata.invoice_url}`);
                try {
                    const download = await downloadFile(metadata.invoice_url);
                    if (download.data) {
                        const safeDate = email.date.split('T')[0];
                        const finalName = sanitizeFilename(`${safeDate}_link_${download.filename || 'invoice.pdf'}`);
                        const upload = await uploadFile(finalName, download.mimeType, download.data, folderId);
                        logs.push(`Uploaded link: ${finalName}`);
                        processedFiles.push({ name: finalName, id: upload.fileId, link: upload.webViewLink });
                    }
                } catch (e: any) {
                    logs.push(`Link download failed: ${e.message}`);
                }
            }

            // Final label
            await addLabel(email.id, 'PROCESSED');
        } else {
            logs.push('Decision: SKIP (Not an invoice)');
            await addLabel(email.id, 'PROCESSED'); // Still label so we don't re-process
        }

        return {
            success: true,
            log: logs,
            result: { emailId: email.id, subject: email.subject, files: processedFiles }
        };

    } catch (error: any) {
        logs.push(`Error in processSingleEmail: ${error.message}`);
        return { success: false, log: logs, result: null };
    }
}

export async function ingestEmails(queryOverride?: string, limit: number = 5): Promise<any[]> {
    const query = queryOverride || 'subject:faktura -label:PROCESSED';
    const messages = await listMessages(query, limit);
    const results = [];

    for (const msg of messages) {
        if (msg.id) {
            const { result } = await processSingleEmail(msg.id);
            if (result) results.push(result);
        }
    }
    return results;
}
