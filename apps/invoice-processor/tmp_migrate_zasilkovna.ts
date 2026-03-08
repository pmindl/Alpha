import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const invoices = await prisma.invoice.findMany({
        where: {
            supplierName: {
                contains: 'Zásilkovna',
            },
            company: 'firma_a'
        }
    });

    console.log(`Found ${invoices.length} Zásilkovna invoices assigned to firma_a. Migrating to firma_b...`);

    for (const inv of invoices) {
        await prisma.invoice.update({
            where: { id: inv.id },
            data: {
                company: 'firma_b',
                status: 'PENDING', // Reset status so it gets picked up by exporter
                errorMessage: null,
                exportedAt: null
            }
        });
        console.log(`Updated invoice ${inv.invoiceNumber} (${inv.id}) -> firma_b (PENDING)`);
    }

    console.log('Migration complete.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
