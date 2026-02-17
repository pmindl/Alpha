import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { parsePacketaInvoice } from '../src/lib/parsers/packeta';
import fs from 'fs';

// Folder ID from run-batch-test.ts
const folderId = '1T7Ew6PoJn8EcFb-9kiR2NaVAp_SRMU6R';

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth });

async function main() {
    console.log(`>>> Searching for Packeta/Zasilkovna invoices in GDrive Folder: ${folderId}`);

    try {
        // 1. List Files (checking for "faktura", "zasilkovna", "packeta" or just list recent 20)
        // Let's list recent 20 and filter by name or content locally
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and mimeType = 'application/pdf'`,
            fields: 'files(id, name, mimeType, createdTime)',
            orderBy: 'createdTime desc',
            pageSize: 20
        });

        const files = res.data.files;

        if (!files || files.length === 0) {
            console.log('No PDF files found in folder.');
            return;
        }

        console.log(`Found ${files.length} recent PDFs. Checking for Packeta candidates...`);

        for (const file of files) {
            if (!file.id || !file.name) continue;

            // Heuristic to save bandwidth: Check filename first? 
            // The user said "Zasilkovna files", so maybe filename contains it?
            // Or we just download and try the parser which checks content.
            // Let's filter by name loosely to prioritize, but try all if few.
            const isNameCandidate = /zasilkovna|packeta|faktura/i.test(file.name);

            console.log(`\nChecking: ${file.name} (${file.id}) [Name match: ${isNameCandidate}]`);

            // Download
            const fileRes = await drive.files.get(
                { fileId: file.id, alt: 'media' },
                { responseType: 'arraybuffer' }
            );
            const buffer = Buffer.from(fileRes.data as ArrayBuffer);

            // Try Parse
            console.log(' -> Parsing with Packeta Parser...');
            const result = await parsePacketaInvoice(buffer);

            if (result) {
                console.log(' -> SUCCESS: Detected Packeta Invoice!');
                console.log('--------------------------------------------------');
                console.log(JSON.stringify(result, null, 2));
                console.log('--------------------------------------------------');
                // We can stop after finding one or continue? Let's continue to find more.
            } else {
                console.log(' -> Skipped (Not identified as Packeta)');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
