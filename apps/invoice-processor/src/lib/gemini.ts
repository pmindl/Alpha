import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedInvoice } from './types';
import { getCompanies } from './companies';

/**
 * Parses an invoice file (text or image/PDF) using Google Gemini AI.
 */
export async function parseInvoice(textOrImage: string | Buffer, mimeType: string = 'text/plain'): Promise<ParsedInvoice> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const companies = getCompanies();
    const companiesPrompt = companies.map(c => `- ${c.id} = ${c.name} (ICO: ${c.ico})`).join('\n');

    const prompt = `
System: You are an accounting AI. Analyze this document and extract invoice data.

Known buyer companies (Our legal entities):
${companiesPrompt}

Return ONLY valid JSON matching this schema:
{
  "is_invoice": boolean,
  "confidence": 0-100,
  "my_company_identifier": "${companies.map(c => c.id).join('" | "')}" | "unknown",
  "supplier": { "name", "ico", "dic", "address" },
  "buyer": { "name", "ico", "dic" },
  "invoice": { "number", "variable_symbol", "date_issued", "date_due", "currency" },
  "items": [{ "name", "quantity", "unit_price", "vat_rate" }],
  "totals": { "subtotal", "vat", "total" }
}
`;

    let result;
    if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
        // For images/PDF, we send the binary data
        // Note: "application/pdf" support in Gemini 1.5/2.0 requires convert to base64
        const imagePart = {
            inlineData: {
                data: Buffer.isBuffer(textOrImage) ? textOrImage.toString('base64') : textOrImage,
                mimeType: mimeType
            },
        };
        result = await model.generateContent([prompt, imagePart]);
    } else {
        // Text input
        result = await model.generateContent([prompt, textOrImage as string]);
    }

    const response = result.response;
    const text = response.text();

    // Extract JSON from markdown code block if present
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
    }

    return JSON.parse(jsonMatch[0]) as ParsedInvoice;
}
