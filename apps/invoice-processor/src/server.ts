import express from 'express';
import cors from 'cors';
import { db } from './lib/db';
import { getCompanies } from './lib/companies';
import { listFiles, downloadFile } from './lib/gdrive';
import { parseInvoice } from './lib/gemini';
import { parsePacketaInvoice } from './lib/parsers/packeta';
import { CompanyConfig, ParsedInvoice } from './lib/types';
import { logEvent } from './lib/logger';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

export async function processCompany(company: CompanyConfig) {
    const results = { processed: 0, skipped: 0, errors: 0 };

    try {
        const files = await listFiles(company.gdriveFolderId);

        for (const file of files) {
            if (!file.id || !file.name) continue;

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
                const { buffer, mimeType } = await downloadFile(file.id);

                let parsed: ParsedInvoice | null = null;
                let isPacketa = false;

                if (mimeType === 'application/pdf') {
                    parsed = await parsePacketaInvoice(buffer);
                    if (parsed) {
                        isPacketa = true;
                        await logEvent(db, 'INFO', 'PacketaParser', `Parsed ${file.name} using deterministic Packeta parser`, { confidence: 100 });
                    }
                }

                if (!parsed) {
                    let textOrImage: string | Buffer = buffer;
                    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
                        textOrImage = buffer.toString('utf-8');
                    }
                    parsed = await parseInvoice(textOrImage, mimeType);
                    await logEvent(db, 'INFO', 'Gemini', `Parsed ${file.name}`, { confidence: parsed.confidence });
                }

                let finalCompanyId = company.id;
                if (parsed.my_company_identifier && parsed.my_company_identifier !== 'unknown') {
                    const validCompany = getCompanies().find(c => c.id === parsed.my_company_identifier);
                    if (validCompany) {
                        finalCompanyId = validCompany.id;
                    }
                }

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

                if (status === 'PENDING' && parsed.invoice.variable_symbol) {
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

                const newInvoice = await db.invoice.create({
                    data: {
                        status,
                        company: finalCompanyId,
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

// Routes
app.post('/api/process', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.headers.authorization?.split(' ')[1];
        if (apiKey !== process.env.APP_API_KEY && apiKey !== process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const companies = getCompanies();
        const summary: Record<string, any> = {};

        for (const company of companies) {
            if (company.gdriveFolderId) {
                summary[company.id] = await processCompany(company);
            }
        }

        res.json({ success: true, summary });
    } catch (error) {
        console.error('Process API error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/api/trigger', async (req, res) => {
    try {
        const action = req.query.action as string;
        const apiKey = process.env.APP_API_KEY || '';
        const portToCall = process.env.PORT || 3002;
        const baseUrl = process.env.APP_BASE_URL || `http://localhost:${portToCall}`;

        if (!action) {
            return res.status(400).json({ error: 'Missing action' });
        }

        let childRes;
        if (action === 'process') {
            childRes = await fetch(`${baseUrl}/api/process`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey }
            });
        } else if (action === 'export') {
            childRes = await fetch(`${baseUrl}/api/export`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const data = await childRes.json();
        res.json(data);
    } catch (error) {
        console.error(`Trigger API Error:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// Start Server
app.listen(port, () => {
    console.log(`Invoice Processor Express Server listening on port ${port}`);
});
