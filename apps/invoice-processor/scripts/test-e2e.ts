import dotenv from 'dotenv';
dotenv.config();

// Register tsconfig-paths to handle @/ aliases if tsx doesn't catch them automatically
import { processCompany } from '../src/app/api/process/route';
import { getCompanies } from '../src/lib/companies';
import { db } from '../src/lib/db';

async function main() {
    console.log('>>> Starting E2E Test');

    const companies = getCompanies();
    // Filter for the company with the GDrive folder we know works
    const targetCompany = companies.find(c => c.gdriveFolderId === '1T7Ew6PoJn8EcFb-9kiR2NaVAp_SRMU6R');

    if (!targetCompany) {
        console.error('Target company not found configuration!');
        process.exit(1);
    }

    console.log(`Testing with Company: ${targetCompany.id} (${targetCompany.name})`);

    // Clean up DB for this test run? 
    // Maybe checking duplicate logic is part of the test.
    // Let's just run it. If it exists, it should say "SKIPPED (Duplicate)".

    const result = await processCompany(targetCompany);
    console.log('\n>>> Processing Summary:', result);

    // Verify DB
    console.log('\n>>> Verifying DB entries...');
    const invoices = await db.invoice.findMany({
        where: { company: targetCompany.id },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    if (invoices.length > 0) {
        console.log(`Found ${invoices.length} recent invoices in DB:`);
        invoices.forEach(inv => {
            console.log(` - [${inv.status}] ${inv.invoiceNumber} (${inv.total} ${inv.currency}) - Source: ${inv.sourceFileName}`);
        });
    } else {
        console.log('No invoices found in DB (might be an error if files were processed).');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
