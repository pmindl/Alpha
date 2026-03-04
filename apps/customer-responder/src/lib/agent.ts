import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    EmailMessage,
    createDraft,
    listEmailsForDrafting,
    applyFeedbackLabels,
    ensureDraftLabelsExist,
} from './gmail';
import { findCustomerOrders, findCustomerContext, getOrder } from './woocommerce';
import { trackPacket, trackAllPackets } from './packeta';
import { searchKnowledgeBase } from './knowledge';
import { extractEntities, type ExtractedEntities } from './entity-extractor';
import { SYSTEM_PROMPT, buildDraftPrompt } from './prompts/system-prompt';

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

function getModel() {
    if (!model) {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY not set!");
            throw new Error("Missing Gemini API Key");
        }
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: SYSTEM_PROMPT,
        } as any);
    }
    return model;
}

/**
 * Validation helper — checks if the AI model is accessible.
 */
export async function validateAI() {
    try {
        const m = getModel();
        await m.generateContent("hello");
        console.log("✅ AI Model is accessible.");
        return true;
    } catch (e: any) {
        console.error("❌ AI Model Error:", e.message);
        return false;
    }
}

/**
 * Processing result for a single email.
 */
export interface ProcessingResult {
    threadId: string;
    success: boolean;
    confidence: number;
    entitiesFound: ExtractedEntities;
    ordersFound: number;
    trackingFound: number;
    kbArticlesUsed: number;
    lookupStrategies: string[];
    error?: string;
}

/**
 * Main pipeline: process all emails ready for drafting.
 * Uses label-based filtering from Gmail Labeler.
 */
export async function processAllEmails(): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    // Ensure DRAFT labels exist
    await ensureDraftLabelsExist();

    // Check AI model accessibility
    if (!await validateAI()) {
        console.warn("⚠️ AI Model unavailable. Aborting.");
        return results;
    }

    // Get emails filtered by ACTION/Prepare-reply label
    const emails = await listEmailsForDrafting();
    console.log(`📬 Found ${emails.length} emails ready for drafting.`);

    for (const email of emails) {
        try {
            const result = await processEmail(email);
            results.push(result);
        } catch (error) {
            console.error(`❌ Unhandled error processing thread ${email.threadId}:`, error);
            results.push({
                threadId: email.threadId,
                success: false,
                confidence: 0,
                entitiesFound: { orderNumbers: [], trackingNumbers: [], emails: [], phones: [], customerName: null },
                ordersFound: 0,
                trackingFound: 0,
                kbArticlesUsed: 0,
                lookupStrategies: [],
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return results;
}

/**
 * Process a single email through the full pipeline.
 */
export async function processEmail(email: EmailMessage): Promise<ProcessingResult> {
    const emailMatch = email.from.match(/<([^>]+)>/);
    const cleanEmail = emailMatch ? emailMatch[1] : email.from;

    console.log(`🤖 Processing email from [REDACTED] — Type: ${email.labels.type || 'unknown'}, Priority: ${email.labels.priority || 'unknown'}`);

    // ── Step 1: Extract Entities ──
    const entities = await extractEntities(email.body, email.from, getModel());
    console.log(`   🔍 Entities: ${entities.orderNumbers.length} orders, ${entities.trackingNumbers.length} tracking, name: ${entities.customerName || 'unknown'}`);

    // ── Step 2: Gather Context (parallel where possible) ──
    const dataAvailability: string[] = [];

    // 2A. WooCommerce + 2B. Knowledge Base (parallel)
    const [customerContext, kbResults] = await Promise.all([
        findCustomerContext(cleanEmail, entities).catch(err => {
            dataAvailability.push('WooCommerce: UNAVAILABLE (API error)');
            logError('WooCommerce lookup failed', err);
            return { orders: [], customer: null, lookupStrategies: ['failed'], available: false };
        }),
        searchKnowledgeBase(`${email.subject}\n${email.body.substring(0, 500)}`).catch(err => {
            dataAvailability.push('Knowledge Base: UNAVAILABLE (search error)');
            logError('Knowledge base search failed', err);
            return [];
        }),
    ]);

    // 2C. Packeta Tracking (depends on WooCommerce orders)
    const trackingResults = await trackAllPackets(
        customerContext.orders,
        entities.trackingNumbers,
    ).catch(err => {
        dataAvailability.push('Packeta: UNAVAILABLE (API error)');
        logError('Packeta tracking failed', err);
        return new Map();
    });

    // ── Step 3: Build Context Strings ──
    let orderContext = "No orders found for this customer.";
    if (!customerContext.available) {
        orderContext = "UNAVAILABLE: WooCommerce data could not be retrieved. Do NOT say no orders were found.";
    } else if (customerContext.orders.length > 0) {
        orderContext = `Found ${customerContext.orders.length} order(s) (searched via: ${customerContext.lookupStrategies.join(', ')}):\n`;
        for (const order of customerContext.orders) {
            orderContext += `- Order #${order.id} (status: ${order.status}, total: ${order.total} ${order.currency}, date: ${order.date_created})\n`;
            if (order.line_items) {
                const items = order.line_items.map((i: any) => i.name).join(', ');
                orderContext += `  Items: ${items}\n`;
            }
            // Attach tracking if available
            for (const [tn, status] of trackingResults) {
                orderContext += `  Tracking ${tn}: ${status.statusText || status.statusCode} (${status.dateTime || 'unknown date'})\n`;
            }
        }
        if (customerContext.customer) {
            orderContext += `\nCustomer profile: ${customerContext.customer.first_name} ${customerContext.customer.last_name}, email: ${customerContext.customer.email}\n`;
        }
    }

    let kbContext = "No relevant knowledge base articles found.";
    if (kbResults.length > 0) {
        kbContext = "Relevant Knowledge Base Articles:\n";
        kbResults.forEach(doc => {
            kbContext += `- [${doc.filename}]: ${doc.content.substring(0, 300)}...\n`;
        });
    }

    // Label context for the prompt
    let labelContext = "";
    if (email.labels.type || email.labels.priority || email.labels.action) {
        const parts = [];
        if (email.labels.type) parts.push(`Type: ${email.labels.type}`);
        if (email.labels.priority) parts.push(`Priority: ${email.labels.priority}`);
        if (email.labels.action) parts.push(`Recommended Action: ${email.labels.action}`);
        if (email.labels.finance) parts.push(`Finance Category: ${email.labels.finance}`);
        labelContext = parts.join('\n');
    }

    // Data availability summary
    if (customerContext.available) dataAvailability.push('WooCommerce: OK');
    if (kbResults.length > 0) dataAvailability.push(`Knowledge Base: ${kbResults.length} articles found`);
    else dataAvailability.push('Knowledge Base: No relevant articles');
    if (trackingResults.size > 0) dataAvailability.push(`Packeta: ${trackingResults.size} tracking result(s)`);

    // ── Step 4: Generate Draft ──
    try {
        const userPrompt = buildDraftPrompt({
            from: email.from,
            subject: email.subject,
            body: email.body,
            orderContext,
            knowledgeContext: kbContext,
            labelContext,
            dataAvailability: dataAvailability.join('\n'),
        });

        const result = await getModel().generateContent(userPrompt);
        const response = result.response;
        const draftText = response.text();

        // ── Step 5: Assess Confidence ──
        const confidence = assessConfidence({
            ordersFound: customerContext.orders.length,
            wooAvailable: customerContext.available,
            trackingFound: trackingResults.size,
            kbArticlesFound: kbResults.length,
            hasLabels: !!(email.labels.type),
            entitiesExtracted: entities.orderNumbers.length + entities.trackingNumbers.length,
        });

        // ── Step 6: Save Draft ──
        const draftSuccess = await createDraft(
            email.threadId,
            email.from,
            `Re: ${email.subject}`,
            draftText,
        );

        // ── Step 7: Apply Feedback Labels ──
        if (draftSuccess) {
            await applyFeedbackLabels(email.threadId, {
                success: true,
                lowConfidence: confidence < 50,
            });
            console.log(`✅ Draft created (confidence: ${confidence}%) for [REDACTED]`);
        } else {
            await applyFeedbackLabels(email.threadId, { success: false });
            console.error(`❌ Failed to create draft for [REDACTED]`);
        }

        return {
            threadId: email.threadId,
            success: draftSuccess,
            confidence,
            entitiesFound: entities,
            ordersFound: customerContext.orders.length,
            trackingFound: trackingResults.size,
            kbArticlesUsed: kbResults.length,
            lookupStrategies: customerContext.lookupStrategies,
        };

    } catch (error) {
        console.error("❌ Error generating draft:", error);
        await applyFeedbackLabels(email.threadId, { success: false });

        return {
            threadId: email.threadId,
            success: false,
            confidence: 0,
            entitiesFound: entities,
            ordersFound: customerContext.orders.length,
            trackingFound: trackingResults.size,
            kbArticlesUsed: kbResults.length,
            lookupStrategies: customerContext.lookupStrategies,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Assess confidence score (0-100) based on data availability.
 */
function assessConfidence(params: {
    ordersFound: number;
    wooAvailable: boolean;
    trackingFound: number;
    kbArticlesFound: number;
    hasLabels: boolean;
    entitiesExtracted: number;
}): number {
    let score = 30; // Base score (AI can still generate a reasonable generic response)

    // WooCommerce data
    if (!params.wooAvailable) score -= 15;     // Major penalty if WooCommerce unreachable
    if (params.ordersFound > 0) score += 30;   // Strong signal — found relevant orders
    if (params.ordersFound >= 2) score += 5;    // Multiple orders = better context

    // Tracking data
    if (params.trackingFound > 0) score += 15;

    // Knowledge base
    if (params.kbArticlesFound > 0) score += 10;
    if (params.kbArticlesFound >= 2) score += 5;

    // Email classification from labeler
    if (params.hasLabels) score += 10;

    // Entity extraction success
    if (params.entitiesExtracted > 0) score += 5;

    return Math.max(0, Math.min(100, score));
}

function logError(context: string, err: unknown) {
    console.warn(`⚠️ ${context}:`, err instanceof Error ? err.message : err);
}
