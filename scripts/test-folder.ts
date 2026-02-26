import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { parseInvoice } from '../src/lib/gemini';

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
    console.log(`Checking GDrive folder: ${folderId}`);
    try {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, createdTime)',
            orderBy: 'createdTime desc',
            pageSize: 5
        });

        const files = res.data.files;
        if (!files || files.length === 0) {
            console.log('No files found in this folder.');
            return;
        }

        console.log(`Found ${files.length} recent files:`);
        files.forEach(f => console.log(` - ${f.name} (${f.mimeType})`));

        // Pick the first supported file
        const supportedFile = files.find(f =>
            f.mimeType === 'application/pdf' ||
            f.mimeType?.startsWith('image/')
        );

        if (!supportedFile) {
            console.log('No supported PDF or Image files found to test.');
            return;
        }

        console.log(`\n>>> Testing File: ${supportedFile.name} <<<`);

        // Download file
        const fileRes = await drive.files.get(
            { fileId: supportedFile.id!, alt: 'media' },
            { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(fileRes.data as ArrayBuffer);

        // Process with Gemini
        console.log('Sending to Gemini...');
        const result = await parseInvoice(buffer, supportedFile.mimeType!);

        console.log('\n--- PARSED RESULT ---');
        console.log(JSON.stringify(result, null, 2));
        console.log('---------------------');

    } catch (error) {
        console.error('Error running test:', error);
    }
}

main();
