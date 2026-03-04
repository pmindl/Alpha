/**
 * Entity Extractor — extracts customer identifiers from email text.
 *
 * Two-phase strategy:
 * 1. Fast regex extraction (no API cost)
 * 2. AI extraction fallback if regex finds insufficient data
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENTITY_EXTRACTION_PROMPT } from './prompts/system-prompt';

export interface ExtractedEntities {
    orderNumbers: number[];
    trackingNumbers: string[];
    emails: string[];
    phones: string[];
    customerName: string | null;
}

const EMPTY_ENTITIES: ExtractedEntities = {
    orderNumbers: [],
    trackingNumbers: [],
    emails: [],
    phones: [],
    customerName: null,
};

/**
 * Phase 1: Regex-based extraction (fast, free).
 */
export function extractEntitiesRegex(text: string, fromHeader: string): ExtractedEntities {
    const result: ExtractedEntities = { ...EMPTY_ENTITIES, orderNumbers: [], trackingNumbers: [], emails: [], phones: [] };

    // Order numbers: #1234, objednávka 1234, order 1234, obj. č. 1234, reklamace číslo 1234, etc.
    const orderPatterns = [
        /#(\d{3,8})/g,
        /(?:objedn[aá]vk[aáy]|order|obj\.?\s*[čc]\.?)\s*#?(\d{3,10})/gi,
        /(?:číslo|number|no\.?)\s*#?(\d{3,10})/gi,
        /(?:reklam[aá]c[eí]|claim|return)\s*(?:č(?:íslo)?\.?)?\s*#?(\d{4,15})/gi,
    ];
    const orderNumbers = new Set<number>();
    for (const pattern of orderPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const num = parseInt(match[1], 10);
            if (num > 0 && num < 999999999999999) {
                orderNumbers.add(num);
            }
        }
    }
    result.orderNumbers = Array.from(orderNumbers);

    // Tracking numbers: Zásilkovna format (Z + digits), or pure tracking-like numbers
    const trackingPatterns = [
        /\b(Z\d{10,15})\b/gi,                    // Zásilkovna
        /(?:tracking|sledov[aá]n[ií]|zásilk[aouy]|číslo zásilky)\s*[:#]?\s*(\w{8,20})/gi,
    ];
    const trackingNumbers = new Set<string>();
    for (const pattern of trackingPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            trackingNumbers.add(match[1].trim());
        }
    }
    result.trackingNumbers = Array.from(trackingNumbers);

    // Email addresses in body
    const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    const emails = new Set<string>();
    let emailMatch;
    while ((emailMatch = emailPattern.exec(text)) !== null) {
        emails.add(emailMatch[1].toLowerCase());
    }
    result.emails = Array.from(emails);

    // Phone numbers
    const phonePatterns = [
        /(\+420\s?\d{3}\s?\d{3}\s?\d{3})/g,
        /(\+\d{1,3}\s?\d{3,4}\s?\d{3,4}\s?\d{3,4})/g,
        /(?:tel\.?|telefon|phone)[:\s]*(\d[\d\s-]{7,15})/gi,
    ];
    const phones = new Set<string>();
    for (const pattern of phonePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            phones.add(match[1].replace(/[\s-]/g, ''));
        }
    }
    result.phones = Array.from(phones);

    // Customer name from From header
    const nameMatch = fromHeader.match(/^([^<]+?)\s*</);
    if (nameMatch) {
        const name = nameMatch[1].replace(/"/g, '').trim();
        if (name && name.length > 1 && !name.includes('@')) {
            result.customerName = name;
        }
    }

    return result;
}

/**
 * Phase 2: AI-based extraction (more accurate, costs tokens).
 * Only called when regex doesn't find enough identifiers.
 */
export async function extractEntitiesAI(
    text: string,
    model: any,
): Promise<ExtractedEntities> {
    try {
        const result = await model.generateContent(
            `${ENTITY_EXTRACTION_PROMPT}\n\nEmail text to analyze:\n${text.substring(0, 1500)}`
        );

        const response = result.response.text();

        // Try to parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                orderNumbers: Array.isArray(parsed.orderNumbers) ? parsed.orderNumbers.map(Number).filter((n: number) => !isNaN(n)) : [],
                trackingNumbers: Array.isArray(parsed.trackingNumbers) ? parsed.trackingNumbers : [],
                emails: Array.isArray(parsed.emails) ? parsed.emails : [],
                phones: Array.isArray(parsed.phones) ? parsed.phones : [],
                customerName: parsed.customerName || null,
            };
        }
    } catch (e) {
        console.warn('⚠️ AI entity extraction failed (continuing with regex results):', e);
    }

    return EMPTY_ENTITIES;
}

/**
 * Combined extraction: regex first, AI fallback if insufficient.
 */
export async function extractEntities(
    emailBody: string,
    fromHeader: string,
    model: any,
): Promise<ExtractedEntities> {
    const regexResults = extractEntitiesRegex(emailBody, fromHeader);

    // Determine if we have enough data
    const hasUsefulData =
        regexResults.orderNumbers.length > 0 ||
        regexResults.trackingNumbers.length > 0 ||
        regexResults.phones.length > 0;

    if (hasUsefulData) {
        return regexResults;
    }

    // Fallback to AI extraction
    const aiResults = await extractEntitiesAI(emailBody, model);

    // Merge: prefer regex results where both have data, add AI-only results
    return {
        orderNumbers: [...new Set([...regexResults.orderNumbers, ...aiResults.orderNumbers])],
        trackingNumbers: [...new Set([...regexResults.trackingNumbers, ...aiResults.trackingNumbers])],
        emails: [...new Set([...regexResults.emails, ...aiResults.emails])],
        phones: [...new Set([...regexResults.phones, ...aiResults.phones])],
        customerName: regexResults.customerName || aiResults.customerName,
    };
}
