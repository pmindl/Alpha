import { listMessages, getMessage, getAttachment, addLabel, getProfile } from '@/lib/gmail';
import { analyzeEmail, analyzeDocument } from '@/lib/ai';
import { upsertFile } from '@/lib/drive';
import { downloadFile } from '@/lib/downloader';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const PRIORITIZED_KEYWORDS = ['faktura', 'invoice', 'doklad', 'účtenka', 'billing', 'dobropis', 'platba', 'tax', 'vat', 'payment', 'receipt'];

const BLACKLIST_KEYWORDS = [
    'zasilkovna', 'balikovna', 'ppl', 'dpd', 'gls', 'toptrans', 'dhl', 'fedex', // Shipping
    'label', 'stitok', 'stitek', 'tracking', 'return', 'reklamace', // Logistics
    'obchodni_podminky', 'terms', 'manual', 'navod', 'instruction', // Docs
    'logo', 'icon', 'banner', 'footer', 'social', 'facebook', 'instagram', 'twitter', 'linkedin' // Junk images
];

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

// Simple file logger
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
    try {
        const email = await getMessage(msgId);
        if (!email) {
            logs.push(`Could not fetch details for message ${msgId}`);
            return { success: false, log: logs, result: null };
        }

        logs.push(`Analyzing: ${email.subject} (${email.id})`);

        const attachmentNames = email.attachments.map(a => a.filename);
        logs.push(`Attachments: ${attachmentNames.join(', ') || 'None'}`);

        // --- HYBRID DETECTION LOGIC ---

        const subjectHasKeyword = containsKeyword(email.subject, PRIORITIZED_KEYWORDS);
        const attachmentsHaveKeyword = attachmentNames.some(name => containsKeyword(name, PRIORITIZED_KEYWORDS));
        const isStrongSignal = subjectHasKeyword || attachmentsHaveKeyword;

        if (isStrongSignal) {
            logs.push(`Strong Keyword Signal Detected! (Subject: ${subjectHasKeyword}, Files: ${attachmentsHaveKeyword})`);
        }

        // AI Analysis (Email Level)
        const metadata = await analyzeEmail(email.subject, email.body, email.sender, attachmentNames);
        logs.push(`AI Analysis Result: ${JSON.stringify(metadata)}`);

        // Decision (Email Level)
        let shouldProcessEmail = false;
        let processReason = '';

        if (metadata.is_invoice) {
            shouldProcessEmail = true;
            processReason = 'AI Confirmed';
        } else if (isStrongSignal) {
            shouldProcessEmail = true;
            processReason = 'Keyword Fallback (AI Override)';
            metadata.document_type = 'invoice';
            metadata.is_invoice = true;
            if (email.attachments.length > 0) {
                metadata.content_type = 'attachment';
            }
        }

        // Process Files
        const processedFiles: { name: string, id: string, link: string, reason: string }[] = [];

        if (shouldProcessEmail) {
            logs.push(`Decision: PROCESS EMAIL (${processReason})`);

            try {
                // 1. Process Attachments
                const validAttachments = email.attachments.filter(a => {
                    const isSupportedMime = SUPPORTED_MIME_TYPES.some(type => a.mimeType.includes(type));
                    const isSupportedExt = /\.(pdf|jpg|jpeg|png|doc|docx|xml|txt)$/i.test(a.filename);
                    return isSupportedMime || isSupportedExt;
                });

                if (validAttachments.length > 0) {
                    logs.push(`Found ${validAttachments.length} supported file candidates.`);

                    for (const target of validAttachments) {
                        const isBlacklisted = containsKeyword(target.filename, BLACKLIST_KEYWORDS);

                        let action: 'UPLOAD' | 'SKIP' = 'SKIP';
                        let reason = '';

                        if (isBlacklisted) {
                            action = 'SKIP';
                            reason = `Blacklisted Term Found (Matched: ${BLACKLIST_KEYWORDS.find(k => target.filename.toLowerCase().includes(k))})`;
                            logDecision(email.id, target.filename, action, reason);
                            logs.push(`Skipped: ${target.filename} (${reason})`);
                            continue; // Skip without downloading content
                        }

                        // --- CONTENT-BASED VERIFICATION ---
                        logs.push(`Verifying content for: ${target.filename}...`);
                        const base64Data = await getAttachment(email.id, target.id);

                        if (base64Data && base64Data.data) {
                            const fileBuffer = Buffer.from(base64Data.data, 'base64');

                            // Call Gemini Vision to inspect the file
                            const contentAnalysis = await analyzeDocument(fileBuffer, target.mimeType);

                            if (contentAnalysis.is_invoice) {
                                action = 'UPLOAD';
                                reason = `AI Content Verified: ${contentAnalysis.reason}`;
                            } else {
                                action = 'SKIP';
                                reason = `AI Rejected Content: ${contentAnalysis.reason}`;
                            }

                            logDecision(email.id, target.filename, action, reason);

                            if (action === 'UPLOAD') {
                                logs.push(`Processing: ${target.filename} [${reason}]`);

                                const safeDate = email.date.split('T')[0];
                                const safeSender = email.sender.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                                const finalName = `${safeDate}_${safeSender}_${target.filename}`;

                                const upload = await upsertFile(finalName, target.mimeType, fileBuffer);
                                logs.push(`${upload.isUpdate ? 'Updated' : 'Uploaded'}: ${finalName} -> ${upload.webViewLink}`);

                                processedFiles.push({
                                    name: finalName,
                                    id: upload.fileId,
                                    link: upload.webViewLink || '',
                                    reason: reason
                                });
                            } else {
                                logs.push(`Skipped: ${target.filename} (${reason})`);
                            }
                        } else {
                            logs.push(`Error: Could not download content for ${target.filename}`);
                        }
                    }
                } else if (metadata.content_type === 'link' && metadata.invoice_url) {
                    // 2. Process Link
                    logs.push(`Attempting download from URL: ${metadata.invoice_url}`);
                    const download = await downloadFile(metadata.invoice_url);
                    if (download.data) {
                        const safeDate = email.date.split('T')[0];
                        const safeSender = email.sender.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                        const finalName = `${safeDate}_${safeSender}_${download.filename || `invoice_${email.id}.pdf`}`;

                        const upload = await upsertFile(finalName, download.mimeType, download.data);
                        logs.push(`${upload.isUpdate ? 'Updated' : 'Uploaded'} Link: ${upload.webViewLink}`);
                        processedFiles.push({
                            name: finalName,
                            id: upload.fileId,
                            link: upload.webViewLink || '',
                            reason: 'Invoice URL Download'
                        });
                    }
                }

                if (processedFiles.length === 0) {
                    logs.push(`No files uploaded. Review logs for skip reasons.`);
                }

            } catch (err: any) {
                logs.push(`Error processing file for ${email.id}: ${err.message}`);
            }
        } else {
            logs.push(`Skipping: Not identified as invoice.`);
        }

        // Always label as processed
        await addLabel(email.id, 'PROCESSED');

        return {
            success: true,
            log: logs,
            result: {
                emailId: email.id,
                subject: email.subject,
                metadata,
                files: processedFiles,
                logs: logs.slice(-20)
            }
        };

    } catch (error: any) {
        logs.push(`Critical Error processing message ${msgId}: ${error.message}`);
        return { success: false, log: logs, result: null };
    }
}

export async function processInvoices(queryOverride?: string, limit: number = 5): Promise<ProcessingResult> {
    const logs: string[] = [];
    try {
        console.log('Starting ingestion request...');
        logs.push('Starting ingestion request...');

        const profile = await getProfile();
        logs.push(`Authenticated as: ${profile?.emailAddress} (Messages Total: ${profile?.messagesTotal})`);

        const query = queryOverride || 'subject:Antigravity -label:PROCESSED';
        console.log('Querying Gmail with:', query);
        logs.push(`Querying Gmail with: ${query}`);

        const messages = await listMessages(query, limit);
        logs.push(`Found ${messages.length} messages matching query.`);

        const results = [];

        for (const msgRef of messages) {
            if (!msgRef.id) continue;

            const { success, log, result } = await processSingleEmail(msgRef.id);
            logs.push(...log);
            if (result) {
                results.push(result);
            }
        }

        return { success: true, processedCount: results.length, results, fullLogs: logs };
    } catch (error) {
        return { success: false, processedCount: 0, results: [], fullLogs: logs, error: String(error) };
    }
}
