import { uploadFile, listFiles } from './gdrive';
import { getCompanies } from './companies';
import { sanitizeFilename } from './utils';
import axios from 'axios';

const PACKETA_ENDPOINT = 'https://www.zasilkovna.cz/api';

/**
 * Downloads Packeta invoices using their REST API.
 * Uses GDrive as the single source of truth for what has been downloaded.
 */
export async function downloadPacketaInvoices() {
    const password = process.env.PACKETA_API_PASSWORD;
    const apiKey = process.env.PACKETA_API_KEY;
    if (!password || !apiKey) {
        throw new Error('PACKETA_API_PASSWORD or PACKETA_API_KEY is not set.');
    }

    // Default to first company that handles Zásilkovna in their email patterns, or default fallback
    const companies = getCompanies();
    let targetCompany = companies.find(c => c.emailPatterns.some(p => p.toLowerCase().includes('zasilkovna') || p.toLowerCase().includes('packeta')));
    if (!targetCompany) {
        targetCompany = companies.find(c => !!c.gdriveFolderId);
    }

    if (!targetCompany || !targetCompany.gdriveFolderId) {
        throw new Error('No target GDrive folder found for Packeta invoices.');
    }

    const processed = [];

    // 1. Get List of Invoices (using CSV endpoint for current month)
    // Format: yyyy-mm-dd
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    console.log(`[Packeta] Fetching invoice.csv (Month-to-date)`);

    try {
        const res = await axios.get(`${PACKETA_ENDPOINT}/invoice.csv`, {
            params: {
                key: apiKey,
                password: password,
                lang: 'cs'
            }
        });
        const csvContent = res.data;

        if (!csvContent) {
            console.log('[Packeta] No CSV content received.');
            return [];
        }

        const invoiceNumbers: string[] = extractInvoiceNumbersFromCSV(csvContent);
        console.log(`[Packeta] Found ${invoiceNumbers.length} unique invoice numbers in CSV.`);

        // 2. Check what is already in GDrive
        const existingFiles = await listFiles(targetCompany.gdriveFolderId);
        const existingNames = new Set(existingFiles.map(f => f.name));

        for (const invNumber of invoiceNumbers) {
            const expectedFileName = sanitizeFilename(`Packeta_${invNumber}.pdf`);

            if (existingNames.has(expectedFileName)) {
                console.log(`[Packeta] Invoice ${invNumber} already downloaded. Skipping.`);
                continue;
            }

            console.log(`[Packeta] Downloading PDF for invoice ${invNumber}...`);
            try {
                const pdfRes = await axios.get(`${PACKETA_ENDPOINT}/invoice.pdf`, {
                    params: {
                        key: apiKey,
                        password: password,
                        number: invNumber
                    },
                    responseType: 'arraybuffer'
                });

                if (pdfRes.status === 200 && pdfRes.data) {
                    await uploadFile(
                        expectedFileName,
                        'application/pdf',
                        Buffer.from(pdfRes.data),
                        targetCompany.gdriveFolderId
                    );
                    processed.push({ invoice: invNumber, file: expectedFileName });
                    console.log(`[Packeta] Uploaded ${expectedFileName} to GDrive.`);
                }
            } catch (pdfError: any) {
                console.error(`[Packeta] Failed to download PDF for ${invNumber}:`, pdfError.response?.status || pdfError.message);
            }
        }

    } catch (e: any) {
        console.error('[Packeta] API Fetch Error:', e.response?.data || e.message);
        throw e;
    }

    return processed;
}

/**
 * Parses Zasilkovna CSV: Mena;Datum vystaveni;Datum splatnosti;Cislo faktury;...
 */
function extractInvoiceNumbersFromCSV(csvString: string): string[] {
    const lines = csvString.split('\n');
    const numbers = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(';');
        if (cols.length > 3) {
            // Index 3 is Cislo faktury
            const potentialInvoice = cols[3].replace(/"/g, '').trim();
            if (/^\d{8,12}$/.test(potentialInvoice)) {
                numbers.add(potentialInvoice);
            }
        }
    }

    return Array.from(numbers);
}
