import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import { ParsedInvoice } from '../types';

/**
 * Extracts text from a PDF buffer.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        return data.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        return '';
    }
}

/**
 * Parses a Packeta invoice from a PDF buffer.
 * Returns null if the document is not recognized as a Packeta invoice.
 */
export async function parsePacketaInvoice(buffer: Buffer): Promise<ParsedInvoice | null> {
    const text = await extractPdfText(buffer);

    // 1. Detection Logic
    // Must contain "Zásilkovna" or "Packeta" AND "Variabilní symbol"
    if (!/(Zásilkovna|Packeta)/i.test(text) || !/Variabilní symbol/i.test(text)) {
        return null; // Not a Packeta invoice
    }

    // Helper functions
    const clean = (s: string) => (s || "").replace(/\s+/g, "");
    const toN = (v: string) => parseFloat((v || "").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    const normalizeDate = (s: string | undefined): string | undefined => {
        if (!s) return undefined;
        // input format: dd.mm.yyyy, output: yyyy-mm-dd
        const m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
        if (m) {
            return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        }
        return undefined;
    };

    // Regex Definitions (adapted from n8n)
    const g = (r: RegExp) => (text.match(r)?.[1] || "").trim();

    // Header Fields
    const varSymbol = g(/Variabilní symbol\s+(\d+)/i);
    const dateIssued = normalizeDate(g(/Datum vystavení:\s*([\d. ]+)/i)) || "";
    const dateDue = normalizeDate(g(/Datum splatnosti:\s*([\d. ]+)/i)) || "";
    const dateTax = normalizeDate(g(/Datum uskutečnění plnění:\s*([\d. ]+)/i)); // datum_plneni
    const invoiceNumber = g(/doklad č\.?\s*(\d+)/i);
    const constantSymbol = g(/(?:Konstantní|Konstatní)\s*symbol\s*(\d+)/i);

    // Currency
    const currency = /CZK/.test(text) ? "CZK" : (/EUR/.test(text) ? "EUR" : "CZK");

    // Bank Account Logic
    const iban = clean(g(/IBAN:?\s*([CZ\d\s]{16,})/i));
    const swift = g(/(?:BIC|SWIFT):?\s*([A-Z0-9]{8,11})/i);

    let bankAccount = "";
    let bankCode = "";
    const accountRegex = /Číslo účtu:?\s*(\d+(?:-\d+)?)(?:\/|\s+)(\d{4})/gi;
    const accountMatches = [...text.matchAll(accountRegex)];

    // Logic from n8n: 1st usually Odběratel, 2nd usually Dodavatel (Zásilkovna)
    // If text contains "2534330302" (Zásilkovna account), prefer that.
    // Or simpler logic: 1st is usually user's account? 
    // n8n logic: if >= 2 matches, take 2nd. If 1, take 1st.
    if (accountMatches.length >= 2) {
        bankAccount = accountMatches[1][1];
        bankCode = accountMatches[1][2];
    } else if (accountMatches.length === 1) {
        bankAccount = accountMatches[0][1];
        bankCode = accountMatches[0][2];
    }

    // Known Buyer/Seller Logic (Hardcoded/Inferred)
    // The n8n script doesn't explicitly parse supplier details other than bank info. 
    // We can infer Zásilkovna from context or hardcode if we know it's them.
    // For now, let's try to extract ICO/DIC if possible, or leave them for user to fill/AI to fallback?
    // No, we want to replace AI. So we should provide robust defaults for Zásilkovna.

    const supplier = {
        name: "Zásilkovna s.r.o.", // or Packeta
        ico: "28408306", // Generic Zásilkovna ICO, potentially extract dynamic if needed
        dic: "CZ28408306",
        address: "Českomoravská 2408/1a, 190 00 Praha 9"
    };

    // Attempt to extract dynamic Supplier ICO/DIC if present near "Dodavatel"
    // But text extraction might jumble it. Hardcoding standard Zásilkovna details is safer if it's always them.
    // Checking n8n: it doesn't seem to extract supplier name/ico, it just creates an expense.
    // We'll stick to a reasonable default or empty if not sure.
    // Let's try to find ICO near "Dodavatel"
    const supplierSectionMatch = text.match(/Dodavatel[\s\S]*?Odběratel/i);
    const supplierSection = supplierSectionMatch ? supplierSectionMatch[0] : "";
    const extractedIco = supplierSection.match(/IČ:?\s*(\d+)/i)?.[1];
    if (extractedIco) supplier.ico = extractedIco;

    // Items Extraction
    // n8n Logic:
    // 1. Isolate items section: "Fakturujeme Vám služby ... Celkem bez DPH"
    // 2. Remove exchange rate lines like "1 EUR = 25 CZK" to avoid confusion
    // 3. Regex match items

    let itemsSection = (text.match(/Fakturujeme Vám služby Množství Cena\/kus DPH % Celkem([\s\S]*?)Celkem bez DPH/i)?.[1] || "")
        .replace(/\d+[.,]\d+\s*EUR,\s*1\s*EUR\s*=\s*[\d.,]+\s*CZK\s*/gi, "");

    if (!itemsSection) {
        // Fallback for simple layouts or different wording?
        // Try searching for just the table start if exact string doesn't match
        // But for now, strict as per n8n is safer.
    }

    const itemRx = /([A-Za-zÁ-ž][A-Za-zÁ-ž0-9()\/,&\s.-]*?)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)\s*%\s+([\d.,]+)\s+[A-Z]{3}/gm;
    const items = [];
    let m;
    let calculatedTotal = 0;

    while ((m = itemRx.exec(itemsSection)) !== null) {
        const name = m[1].trim().replace(/\s+/g, " ");
        // Filter out bad matches (n8n: name must contain letters, no '=')
        if (!/[A-Za-zÁ-ž]/.test(name) || /=/.test(name)) continue;

        const quantity = toN(m[2]);
        const unitPriceNet = toN(m[3]);
        const vatRate = toN(m[4]);

        // Calculate gross price per unit (n8n logic: net * (1 + vat/100))
        const unitPriceGross = parseFloat((unitPriceNet * (1 + (vatRate / 100))).toFixed(2));

        items.push({
            name,
            quantity,
            unit_price: unitPriceGross,
            vat_rate: vatRate
        });

        calculatedTotal += (unitPriceGross * quantity);
    }

    // Totals
    // Extract declared total
    const totalRx = /Fakturovaná částka včetně DPH\s+([\d.,\s]+)/i;
    const totalMatch = text.match(totalRx);
    const declaredTotal = totalMatch ? toN(totalMatch[1]) : 0;

    // Correction Logic (Penny rounding diffs)
    if (declaredTotal > 0 && items.length > 0) {
        const diff = parseFloat((declaredTotal - calculatedTotal).toFixed(2));
        if (Math.abs(diff) > 0) {
            // Distribute diff to the item with max total value (n8n logic)
            let bestIndex = 0;
            let maxTotal = 0;
            items.forEach((item, idx) => {
                const lineTotal = item.unit_price * item.quantity;
                if (lineTotal > maxTotal) {
                    maxTotal = lineTotal;
                    bestIndex = idx;
                }
            });
            const originalPrice = items[bestIndex].unit_price;
            const correctionPerUnit = diff / items[bestIndex].quantity;
            items[bestIndex].unit_price = parseFloat((originalPrice + correctionPerUnit).toFixed(2));
        }
    }

    return {
        is_invoice: true,
        confidence: 100, // Deterministic parser
        my_company_identifier: "unknown", // To be filled by matching logic if needed -> or passed from context
        supplier: supplier,
        buyer: {
            name: "Lumenica s.r.o.", // Could infer or leave empty
            ico: "",
            dic: ""
        },
        invoice: {
            number: invoiceNumber,
            variable_symbol: varSymbol,
            date_issued: dateIssued,
            date_due: dateDue,
            currency: currency
        },
        items: items,
        totals: {
            subtotal: 0, // Calculated?
            vat: 0,
            total: declaredTotal || calculatedTotal
        }
    };
}
