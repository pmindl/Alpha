import { processInvoice } from '../src/app/api/process/route';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
    // 1. Setup
    const testFile = process.argv[2];
    if (!testFile) {
        console.error('Usage: npx tsx scripts/test-processing.ts <path-to-pdf>');
        process.exit(1);
    }

    const absolutePath = path.resolve(testFile);
    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
    }

    console.log(`>>> Starting Manual Processing Test for: ${path.basename(absolutePath)}`);

    // 2. Mock GDrive File
    // We create a dummy file ID and skip the download step by hacking/mocking or just ensuring the file exists?
    // The `processInvoice` function takes a file ID. 
    // It calls `downloadFile` internally. 
    // To avoid mocking `downloadFile` (which is hard without modifying code), 
    // we can copy the local file to the temporary download location that `processInvoice` expects?
    // Actually, `processInvoice` calls `gemini.parseInvoice(filePath)`.
    // Let's reuse the core logic but skip the specific GDrive download part.
    // We will import `parseInvoice` and `createExpense` and `prisma` directly to simulate the flow.

    /*
      Flow:
      1. Parse PDF with Gemini
      2. Save to DB
      3. Export to SuperFaktura
    */

    const { parseInvoice } = await import('../src/lib/gemini');
    const { createExpense, checkDuplicate } = await import('../src/lib/superfaktura');

    // 1. Parsing
    console.log('--- Step 1: Parsing with Gemini ---');
    const parsed = await parseInvoice(absolutePath);
    console.log('Parsed data:', {
        invoiceNumber: parsed.invoice.invoice_number,
        vs: parsed.invoice.variable_symbol,
        total: parsed.totals.total,
        currency: parsed.invoice.currency,
        date: parsed.invoice.date_issued
    });

    // 2. DB Saving (Mocking the "save to db" part or actually saving?)
    // Let's actually save to DB to test the full schema
    console.log('--- Step 2: Saving to Database ---');
    const invoiceRecord = await prisma.invoice.create({
        data: {
            status: 'processed',
            company: 'lumenica', // Default for test
            supplierName: parsed.supplier.name,
            supplierIco: parsed.supplier.ico,
            invoiceNumber: parsed.invoice.invoice_number,
            variableSymbol: parsed.invoice.variable_symbol,
            dateIssued: parsed.invoice.date_issued ? new Date(parsed.invoice.date_issued) : null,
            dateDue: parsed.invoice.date_due ? new Date(parsed.invoice.date_due) : null,
            total: parsed.totals.total,
            currency: parsed.invoice.currency,
            sourceType: 'manual_test',
            sourceFileName: path.basename(absolutePath),
            rawJson: JSON.stringify(parsed),
            confidence: 1.0
        }
    });
    console.log(`Saved Invoice ID: ${invoiceRecord.id}`);

    // 3. SuperFaktura Export
    console.log('--- Step 3: Exporting to SuperFaktura ---');

    // Duplicate Check
    const isDuplicate = await checkDuplicate(parsed.invoice.variable_symbol);
    if (isDuplicate) {
        console.log('>>> DUPLICATE detected in SF. Skipping export.');
    } else {
        const companyConfig = {
            name: 'Lumenica s.r.o.',
            sf_api_email: process.env.SF_API_EMAIL!,
            sf_api_key: process.env.SF_API_KEY!,
            sf_company_id: process.env.SF_COMPANY_ID!
        };

        const sfResult = await createExpense(parsed, companyConfig, path.basename(absolutePath));
        if (sfResult.error) {
            console.error('>>> Export FAILED:', sfResult.error);
        } else {
            console.log(`>>> SUCCESS! Exported. New SF ID: ${sfResult.id}`);
            // Update DB
            await prisma.invoice.update({
                where: { id: invoiceRecord.id },
                data: {
                    externalId: sfResult.id,
                    exportedAt: new Date()
                }
            });
            console.log('DB Updated with SF ID.');
        }
    }

    console.log('--- Test Complete ---');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
