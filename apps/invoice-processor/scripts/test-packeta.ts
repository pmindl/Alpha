import { parsePacketaInvoice } from '../src/lib/parsers/packeta';
import fs from 'fs';
import path from 'path';

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide a file path: npx tsx scripts/test-packeta.ts <path-to-invoice.pdf>');
        process.exit(1);
    }

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
    }

    console.log(`Reading file: ${absolutePath}`);
    const buffer = fs.readFileSync(absolutePath);

    console.log('Parsing...');
    try {
        const result = await parsePacketaInvoice(buffer);
        if (result) {
            console.log('--------------------------------------------------');
            console.log('SUCCESS: Recognized as Packeta Invoice');
            console.log('--------------------------------------------------');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('--------------------------------------------------');
            console.log('RESULT: Not recognized as Packeta Invoice (returned null)');
            console.log('--------------------------------------------------');
        }
    } catch (error) {
        console.error('Error parsing file:', error);
    }
}

main();
