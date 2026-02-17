import { parseInvoice } from '../src/lib/gemini';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config(); // Load env vars

async function runTest() {
    const filename = process.argv[2];
    if (!filename) {
        console.error('Usage: ts-node scripts/manual-test.ts <path-to-file>');
        process.exit(1);
    }

    const filePath = path.resolve(filename);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`Processing file: ${filePath}`);
    try {
        const buffer = fs.readFileSync(filePath);
        // Basic MIME type detection
        const mimeType = filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

        const result = await parseInvoice(buffer, mimeType);
        console.log('--- Processing Result ---');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

runTest();
