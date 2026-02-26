import dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/lib/db';
import { createExpense, checkDuplicate } from '../src/lib/superfaktura';
import { getCompanies } from '../src/lib/companies';

async function main() {
    console.log('>>> Starting SuperFaktura Export Test');

    // 1. Check Credentials
    if (!process.env.SF_API_KEY || !process.env.SF_API_EMAIL) {
        console.error('ERROR: Missing SF_API_KEY or SF_API_EMAIL in .env');
        console.log('Please add them and try again.');
        process.exit(1);
    }

    // 2. Find a candidate invoice (PENDING)
    const invoice = await db.invoice.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' }
    });

    if (!invoice) {
        console.log('No PENDING invoices found in DB to test.');
        return;
    }

    console.log(`Testing with Invoice: ${invoice.invoiceNumber} (ID: ${invoice.id})`);
    console.log(`Source File: ${invoice.sourceFileName}`);
    console.log(`Variable Symbol: ${invoice.variableSymbol}`);

    const company = getCompanies().find(c => c.id === invoice.company);
    if (!company) {
        console.error(`Company configuration not found for ID: ${invoice.company}`);
        return;
    }

    // 3. Check Duplicate
    if (invoice.variableSymbol) {
        console.log(`Checking duplicate for VS: ${invoice.variableSymbol}...`);
        const isDup = await checkDuplicate(invoice.variableSymbol);
        if (isDup) {
            console.log('>>> DUPLICATE DETECTED! (This is good, validation works)');
            console.log('Skipping export to avoid spamming SF.');
            return;
        } else {
            console.log('>>> No duplicate found. Proceeding to export...');
        }
    } else {
        console.log('No Variable Symbol, skipping duplicate check.');
    }

    // 4. Export (Only if not duplicate)
    console.log('Preparing payload...');
    const fullInvoiceData = JSON.parse(invoice.rawJson);

    console.log('Sending to SuperFaktura...');
    const res = await createExpense(fullInvoiceData, company, invoice.sourceFileName!);

    if (res.id) {
        console.log(`>>> SUCCESS! Exported. New SF ID: ${res.id}`);
        // Update DB status so it shows up in lists
        await db.invoice.update({
            where: { id: invoice.id },
            data: {
                status: 'EXPORTED',
                externalId: res.id,
                exportedAt: new Date()
            }
        });
        console.log('>>> DB Updated.');
    } else {
        console.error(`>>> FAILED: ${res.error}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await db.$disconnect();
    });
