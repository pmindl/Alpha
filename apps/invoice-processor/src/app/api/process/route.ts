import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCompanies } from '@/lib/companies';
import { listFiles, downloadFile } from '@/lib/gdrive';
import { parseInvoice } from '@/lib/gemini';
import { parsePacketaInvoice } from '@/lib/parsers/packeta';
import { CompanyConfig, ParsedInvoice } from '@/lib/types';
import { logEvent } from '@/lib/logger';

export const maxDuration = 60; // Allow 60s for processing

export async function processCompany(company: CompanyConfig) {
    const results = { processed: 0, skipped: 0, errors: 0 };

    try {
        const files = await listFiles(company.gdriveFolderId);

        for (const file of files) {
            if (!file.id || !file.name) continue;

            // 1. Check if already processed
            const existing = await db.invoice.findFirst({
                where: { sourceFileId: file.id }
            });

            if (existing) {
                results.skipped++;
                continue;
            }

            console.log(`Processing file: ${file.name} (${file.id})`);
            await logEvent(db, 'INFO', 'API', `Starting processing for ${file.name}`, { fileId: file.id });

            try {
                // 2. Download
                const { buffer, mimeType } = await downloadFile(file.id);

                // 3. Parse Invoice
                let parsed: ParsedInvoice | null = null;
                let isPacketa = false;

                // Try Packeta Parser (Deterministic)
                if (mimeType === 'application/pdf') {
                    parsed = await parsePacketaInvoice(buffer);
                    if (parsed) {
                        isPacketa = true;
                        await logEvent(db, 'INFO', 'PacketaParser', `Parsed ${file.name} using deterministic Packeta parser`, { confidence: 100 });
                    }
                }

                // Fallback to Gemini AI
                if (!parsed) {
                    // Gemini handles PDF/Images via buffer. Text files need string conversion.
                    let textOrImage: string | Buffer = buffer;
                    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
                        textOrImage = buffer.toString('utf-8');
                    }
                    parsed = await parseInvoice(textOrImage, mimeType);
                    await logEvent(db, 'INFO', 'Gemini', `Parsed ${file.name}`, { confidence: parsed.confidence });
                }

                // 5. Logic checks
                let status = 'PENDING';
                let errorMessage = '';

                if (!parsed.is_invoice) {
                    status = 'SKIPPED';
                    errorMessage = 'Not recognized as invoice';
                    await logEvent(db, 'WARN', 'API', `Skipped ${file.name}: Not an invoice`, null);
                } else if (parsed.confidence < 60) {
                    status = 'SKIPPED';
                    errorMessage = `Low confidence: ${parsed.confidence}%`;
                    await logEvent(db, 'WARN', 'API', `Skipped ${file.name}: Low confidence`, { confidence: parsed.confidence });
                }

                // 6. External Duplicate Check
                if (status === 'PENDING' && parsed.invoice.variable_symbol) {
                    // Check against DB first to be sure
                    const dbDup = await db.invoice.findFirst({
                        where: {
                            supplierIco: parsed.supplier.ico,
                            invoiceNumber: parsed.invoice.number
                        }
                    });
                    if (dbDup) {
                        status = 'DUPLICATE';
                        errorMessage = 'Duplicate in local DB';
                        await logEvent(db, 'WARN', 'API', `Duplicate in DB: ${parsed.invoice.variable_symbol}`, null);
                    }
                }

                // 7. Save to DB
                const newInvoice = await db.invoice.create({
                    data: {
                        status,
                        company: company.id,
                        supplierName: parsed.supplier.name || 'Unknown',
                        supplierIco: parsed.supplier.ico,
                        supplierDic: parsed.supplier.dic,
                        invoiceNumber: parsed.invoice.number || 'UNKNOWN',
                        variableSymbol: parsed.invoice.variable_symbol,
                        dateIssued: parsed.invoice.date_issued,
                        dateDue: parsed.invoice.date_due,
                        total: parsed.totals.total || 0,
                        currency: parsed.invoice.currency || 'CZK',
                        sourceType: 'GDRIVE',
                        sourceFileId: file.id,
                        sourceFileName: file.name,
                        rawJson: JSON.stringify(parsed),
                        errorMessage: errorMessage || null,
                        confidence: parsed.confidence || 0,
                    }
                });

                if (status === 'PENDING') {
                    await logEvent(db, 'INFO', 'API', `Invoice created and pending export: ${newInvoice.id}`, null, newInvoice.id);
                }

                results.processed++;

            } catch (err) {
                console.error(`Error processing file ${file.id}:`, err);
                await logEvent(db, 'ERROR', 'API', `Error processing ${file.name}`, { error: (err as Error).message });

                // Record error in DB so we don't loop forever
                await db.invoice.create({
                    data: {
                        status: 'EXPORT_ERROR',
                        company: company.id,
                        supplierName: 'ERROR',
                        invoiceNumber: `ERR-${Date.now()}`,
                        total: 0,
                        sourceType: 'GDRIVE',
                        sourceFileId: file.id,
                        sourceFileName: file.name,
                        rawJson: '{}',
                        errorMessage: (err as Error).message,
                    }
                });
                results.errors++;
            }
        }
    } catch (error) {
        console.error(`Error listing files for ${company.id}:`, error);
    }

    return results;
}

export async function POST(request: Request) {
    // Check auth
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.APP_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companies = getCompanies();
    const summary: Record<string, any> = {};

    for (const company of companies) {
        if (company.gdriveFolderId) {
            summary[company.id] = await processCompany(company);
        }
    }

    return NextResponse.json({ success: true, summary });
}
