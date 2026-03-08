import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const invoices = await prisma.invoice.findMany({
        where: {
            supplierName: {
                contains: 'Zásilkovna',
            }
        },
        select: {
            id: true,
            invoiceNumber: true,
            supplierName: true,
            company: true,
            sourceType: true,
            sourceFileName: true
        }
    });

    console.log(JSON.stringify(invoices, null, 2));
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
