import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { parseInvoice } from '../src/lib/gemini';
import { createExpense, checkDuplicate } from '../src/lib/superfaktura';
import { PrismaClient } from '@prisma/client';
import { logEvent } from '../src/lib/logger';

const folderId = '1T7Ew6PoJn8EcFb-9kiR2NaVAp_SRMU6R';
const prisma = new PrismaClient();

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth });

interface ProcessLog {
    fileName: string;
    status: 'Skipped' | 'Processed' | 'Duplicate' | 'Error';
    detail: string;
    invoiceNumber?: string;
    vs?: string;
    sfId?: string;
}

async function main() {
    console.log(`>>> Starting Batch Processing Test on Folder: ${folderId}`);
    const logs: ProcessLog[] = [];

    try {
        // 1. List Files
        let files: any[] = [];
        let pageToken: string | undefined = undefined;

        do {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
                orderBy: 'createdTime desc',
                pageSize: 20,
                pageToken
            });
            if (res.data.files) {
                files = files.concat(res.data.files);
            }
            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);

        if (files.length === 0) {
            console.log('No files found.');
            return;
        }

        console.log(`Found ${files.length} files. Processing...`);

        // 2. Process Each File
        for (const file of files) {
            console.log(`\nProcessing: ${file.name}...`);
            await logEvent(prisma, 'INFO', 'BatchProcessor', `Starting processing for ${file.name}`, { fileId: file.id });

            // Skip non-supported
            if (file.mimeType !== 'application/pdf' && !file.mimeType?.startsWith('image/')) {
                logs.push({ fileName: file.name, status: 'Skipped', detail: 'Unsupported MIME type' });
                await logEvent(prisma, 'WARN', 'BatchProcessor', `Skipped ${file.name}: Unsupported MIME type`, null);
                continue;
            }

            try {
                // Download
                const fileRes = await drive.files.get(
                    { fileId: file.id, alt: 'media' },
                    { responseType: 'arraybuffer' }
                );
                const buffer = Buffer.from(fileRes.data as ArrayBuffer);

                // Gemini Parse
                const parsed = await parseInvoice(buffer, file.mimeType);
                await logEvent(prisma, 'INFO', 'Gemini', `Parsed ${file.name}`, { confidence: parsed.confidence });

                // Confidence Check
                if (parsed.confidence < 0.8) {
                    logs.push({
                        fileName: file.name,
                        status: 'Error',
                        detail: `Low Confidence (${parsed.confidence})`,
                        invoiceNumber: parsed.invoice.number,
                        vs: parsed.invoice.variable_symbol
                    });
                    await logEvent(prisma, 'ERROR', 'BatchProcessor', `Low confidence for ${file.name}`, { confidence: parsed.confidence });
                    continue;
                }

                function safeDate(d: any): Date | null | undefined {
                    if (!d) return null;
                    const date = new Date(d);
                    return isNaN(date.getTime()) ? null : date;
                }

                // Database Save
                let invoiceId = '';
                try {
                    // Check if exists first (or use upsert if ID was known, but here we only know ICO+Number)
                    const existing = await prisma.invoice.findFirst({
                        where: {
                            supplierIco: parsed.supplier.ico,
                            invoiceNumber: parsed.invoice.number || ''
                        }
                    });

                    if (existing) {
                        console.log(` -> Invoice already in DB (${existing.id}). Updating...`);
                        const updated = await prisma.invoice.update({
                            where: { id: existing.id },
                            data: {
                                status: 'processed',
                                // Update fields if needed, or just keep existing
                                sourceFileId: file.id,
                                sourceFileName: file.name,
                                rawJson: JSON.stringify(parsed),
                                confidence: parsed.confidence,
                                variableSymbol: parsed.invoice.variable_symbol, // Ensure VS is up to date
                                dateIssued: safeDate(parsed.invoice.date_issued)?.toISOString(),
                                dateDue: safeDate(parsed.invoice.date_due)?.toISOString(),
                                total: parsed.totals.total || 0,
                                currency: parsed.invoice.currency || 'CZK'
                            }
                        });
                        invoiceId = updated.id;
                        await logEvent(prisma, 'INFO', 'DB', `Updated existing invoice ${invoiceId}`, { invoiceNumber: parsed.invoice.number }, invoiceId);
                    } else {
                        const created = await prisma.invoice.create({
                            data: {
                                status: 'processed',
                                company: 'lumenica',
                                supplierName: parsed.supplier.name || 'Unknown',
                                supplierIco: parsed.supplier.ico,
                                invoiceNumber: parsed.invoice.number || `MISSING-${Date.now()}`,
                                variableSymbol: parsed.invoice.variable_symbol,
                                dateIssued: safeDate(parsed.invoice.date_issued)?.toISOString(),
                                dateDue: safeDate(parsed.invoice.date_due)?.toISOString(),
                                total: parsed.totals.total || 0,
                                currency: parsed.invoice.currency || 'CZK',
                                sourceType: 'batch_test',
                                sourceFileId: file.id,
                                sourceFileName: file.name,
                                rawJson: JSON.stringify(parsed),
                                confidence: parsed.confidence
                            }
                        });
                        invoiceId = created.id;
                        await logEvent(prisma, 'INFO', 'DB', `Created new invoice ${invoiceId}`, { invoiceNumber: parsed.invoice.number }, invoiceId);
                    }
                } catch (dbError) {
                    console.error(' -> DB Error:', dbError);
                    logs.push({ fileName: file.name, status: 'Error', detail: `DB Error: ${(dbError as Error).message}` });
                    await logEvent(prisma, 'ERROR', 'DB', `Database error for ${file.name}`, { error: (dbError as Error).message });
                    continue;
                }

                // Duplicate Check
                if (!parsed.invoice.variable_symbol) {
                    logs.push({
                        fileName: file.name,
                        status: 'Error',
                        detail: 'Missing Variable Symbol',
                        invoiceNumber: parsed.invoice.number
                    });
                    await logEvent(prisma, 'WARN', 'BatchProcessor', `Missing Variable Symbol for ${file.name}`, null, invoiceId);
                    continue;
                }

                const isDuplicate = await checkDuplicate(parsed.invoice.variable_symbol);
                if (isDuplicate) {
                    logs.push({
                        fileName: file.name,
                        status: 'Duplicate',
                        detail: 'Exists in SuperFaktura',
                        invoiceNumber: parsed.invoice.number,
                        vs: parsed.invoice.variable_symbol
                    });
                    await logEvent(prisma, 'WARN', 'SuperFaktura', `Duplicate detected: ${parsed.invoice.variable_symbol}`, null, invoiceId);

                    // Mark as DUPLICATE in DB if not already
                    if (invoiceId) {
                        await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'DUPLICATE' } });
                    }
                    continue;
                }

                // Export
                const companyConfig = {
                    name: 'Lumenica s.r.o.',
                    sf_api_email: process.env.SF_API_EMAIL!,
                    sf_api_key: process.env.SF_API_KEY!,
                    sf_company_id: process.env.SF_COMPANY_ID!,
                    // Mock missing fields to satisfy type if needed, or cast
                    id: 'mock', ico: 'mock', gdriveFolderId: 'mock', sfClientId: 'mock', emailPatterns: []
                };

                const sfResult = await createExpense(parsed, companyConfig, file.name);

                if (sfResult.error) {
                    logs.push({
                        fileName: file.name,
                        status: 'Error',
                        detail: `SF Error: ${sfResult.error}`,
                        invoiceNumber: parsed.invoice.number,
                        vs: parsed.invoice.variable_symbol
                    });
                    await logEvent(prisma, 'ERROR', 'SuperFaktura', `Export failed: ${sfResult.error}`, null, invoiceId);
                    if (invoiceId) await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'EXPORT_ERROR', errorMessage: sfResult.error } });
                } else {
                    logs.push({
                        fileName: file.name,
                        status: 'Processed',
                        detail: 'Successfully Exported',
                        sfId: sfResult.id,
                        invoiceNumber: parsed.invoice.number,
                        vs: parsed.invoice.variable_symbol
                    });
                    await logEvent(prisma, 'INFO', 'SuperFaktura', `Successfully exported. SF ID: ${sfResult.id}`, null, invoiceId);
                    if (invoiceId) await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'EXPORTED', externalId: sfResult.id } });
                }

            } catch (err) {
                logs.push({ fileName: file.name, status: 'Error', detail: (err as Error).message });
                await logEvent(prisma, 'ERROR', 'BatchProcessor', `Fatal error processing ${file.name}`, { error: (err as Error).message });
            }
        }

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        await prisma.$disconnect();
        printSummary(logs);
    }
}

function printSummary(logs: ProcessLog[]) {
    console.log('\n\n=== BATCH PROCESSING SUMMARY ===');
    console.log('| File Name | Status | Invoice # | VS | Detail | SF ID |');
    console.log('|---|---|---|---|---|---|');
    logs.forEach(l => {
        console.log(`| ${l.fileName} | **${l.status}** | ${l.invoiceNumber || '-'} | ${l.vs || '-'} | ${l.detail} | ${l.sfId || '-'} |`);
    });
    console.log('================================');
}

main();
