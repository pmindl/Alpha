import dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/lib/db';

async function main() {
    console.log('>>> Listing Exported Invoices');

    const exported = await db.invoice.findMany({
        where: { status: 'EXPORTED' },
        orderBy: { exportedAt: 'desc' }
    });

    if (exported.length === 0) {
        console.log('No invoices found with status "EXPORTED".');

        // Also check if any have an externalId but maybe status wasn't updated?
        const withId = await db.invoice.findMany({
            where: {
                NOT: { externalId: null },
                status: { not: 'EXPORTED' }
            }
        });

        if (withId.length > 0) {
            console.log(`\nHowever, found ${withId.length} invoices with externalId but different status:`);
            withId.forEach(inv => {
                console.log(`- ${inv.invoiceNumber} (${inv.status}) - Ref: ${inv.externalId}`);
            });
        }

    } else {
        console.log(`Found ${exported.length} exported invoices:`);
        console.log('----------------------------------------------------------------');
        console.log(String('Date').padEnd(12) + String('Number').padEnd(15) + String('Supplier').padEnd(25) + String('Amount').padEnd(12) + 'SF ID');
        console.log('----------------------------------------------------------------');

        exported.forEach(inv => {
            const date = inv.exportedAt ? inv.exportedAt.toISOString().split('T')[0] : 'N/A';
            console.log(
                date.padEnd(12) +
                (inv.invoiceNumber || 'N/A').padEnd(15) +
                (inv.supplierName || 'Unknown').substring(0, 24).padEnd(25) +
                `${inv.total} ${inv.currency}`.padEnd(12) +
                inv.externalId
            );
        });
        console.log('----------------------------------------------------------------');
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await db.$disconnect();
    });
