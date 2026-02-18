import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmailMessage, createDraft } from './gmail';
import { findCustomerOrders, getOrder } from './woocommerce';
import { trackPacket } from './packeta';
import { searchKnowledgeBase } from './knowledge';

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
        // Using gemini-2.0-flash as confirmed by API check
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }
    return model;
}

// Validation helper
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

export async function processEmail(email: EmailMessage) {
    // Extract pure email address from "Name <email@domain.com>" format
    const emailMatch = email.from.match(/<([^>]+)>/);
    const cleanEmail = emailMatch ? emailMatch[1] : email.from;

    console.log(`🤖 Processing email: ${email.subject} from ${cleanEmail}`);

    // Check key availability early
    if (!await validateAI()) {
        console.warn("⚠️ Skipping AI processing check due to invalid key/model.");
        return false;
    }

    // 1. Gather Context
    // A. WooCommerce Orders
    const orders = await findCustomerOrders(cleanEmail);
    let orderContext = "No recent orders found.";

    if (orders.length > 0) {
        orderContext = `Found ${orders.length} recent orders:\n`;
        for (const order of orders) {
            orderContext += `- Order #${order.id} (${order.status}, Total: ${order.total} ${order.currency})\n`;

            // B. Packeta Tracking (if applicable)
            // Assuming tracking number is in meta_data or a custom field. 
            // Adapting based on common Woo plugins (e.g., Zasilkovna).
            // This is hypothetical until actual data structure is known.
            const trackingNumber = findTrackingNumber(order);
            if (trackingNumber) {
                const tracking = await trackPacket(trackingNumber);
                if (tracking) {
                    orderContext += `  - Tracking (${trackingNumber}): ${JSON.stringify(tracking)}\n`;
                }
            }
        }
    }

    // C. Knowledge Base
    let kbContext = "No relevant knowledge base articles found.";
    try {
        const query = `${email.subject}\n${email.body.substring(0, 500)}`; // Truncate body for query
        const kbResults = await searchKnowledgeBase(query);
        if (kbResults.length > 0) {
            kbContext = "Relevant Knowledge Base Articles:\n";
            kbResults.forEach(doc => {
                kbContext += `- [${doc.filename}]: ${doc.content.substring(0, 200)}...\n`;
            });
        }
    } catch (e) {
        console.warn("⚠️ Knowledge Base search failed (continuing without it):", e);
    }

    // 2. Construct Prompt
    const prompt = `
You are a helpful customer support agent for an online store.
Your goal is to draft a polite, helpful reply to a customer email.
DO NOT send the email. Just write the draft.

Incoming Email:
From: ${email.from}
Subject: ${email.subject}
Body:
"""
${email.body}
"""

Context:
${orderContext}

${kbContext}

Instructions:
- Be polite and professional.
- Use the context provided to answer their question (e.g., order status, return policy).
- If you don't know the answer, ask for clarification or say you will check with a human.
- Sign off as "Customer Support Team".
- Output ONLY the email body.
    `;

    // 3. Generate Draft
    try {
        const result = await getModel().generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // 4. Save Draft
        const success = await createDraft(email.threadId, email.from, `Re: ${email.subject}`, text);
        if (success) {
            console.log(`✅ Draft created for ${email.subject}`);
            return true;
        } else {
            console.error(`❌ Failed to create draft for ${email.subject}`);
            return false;
        }
    } catch (error) {
        console.error("❌ Error generating draft:", error);
        return false;
    }
}

// Helper to find tracking number in Woo Order
function findTrackingNumber(order: any): string | null {
    // Common places: meta_data
    // Key might be '_packet_id', 'tracking_number', etc.
    // Iterating to find something that looks like a tracking number
    if (order.meta_data) {
        const trackingMeta = order.meta_data.find((m: any) =>
            m.key === '_packet_id' ||
            m.key === 'tracking_number' ||
            (m.key && m.key.includes('tracking'))
        );
        if (trackingMeta) return trackingMeta.value;
    }
    return null;
}
