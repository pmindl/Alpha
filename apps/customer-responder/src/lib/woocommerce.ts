import WooCommerceRestApi from "woocommerce-rest-ts-api";
import { logErrorSafely } from './logger';
import type { ExtractedEntities } from './entity-extractor';

let api: WooCommerceRestApi<any> | null = null;

function getApi() {
    if (!api) {
        if (!process.env.WOOCOMMERCE_URL || process.env.WOOCOMMERCE_URL.includes('yourstore.com')) {
            console.warn("⚠️ WOOCOMMERCE_URL is invalid (placeholder). Skipping WooCommerce calls.");
            return null;
        }
        api = new WooCommerceRestApi({
            url: process.env.WOOCOMMERCE_URL!,
            consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
            consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
            version: "wc/v3"
        });
    }
    return api;
}

/**
 * Result of a comprehensive customer context lookup.
 */
export interface CustomerContext {
    orders: any[];
    customer: any | null;
    lookupStrategies: string[];
    available: boolean;
}

/**
 * Simple order lookup by email (legacy, kept for MCP tool).
 */
export async function findCustomerOrders(email: string) {
    const client = getApi();
    if (!client) return [];

    try {
        const response = await client.get("orders", {
            search: email,
            per_page: 5
        });
        return response.data;
    } catch (error) {
        logErrorSafely("Error fetching WooCommerce orders", error);
        return [];
    }
}

/**
 * Get a single order by ID.
 */
export async function getOrder(id: number) {
    const client = getApi();
    if (!client) return null;

    try {
        const response = await client.get(`orders/${id}`, {});
        return response.data;
    } catch (error) {
        logErrorSafely("Error fetching WooCommerce order", error);
        return null;
    }
}

/**
 * Multi-strategy customer context lookup.
 *
 * Tries multiple strategies in parallel to find the customer's orders:
 * 1. By sender email address
 * 2. By order number (if found in email body)
 * 3. By other email addresses mentioned in body
 * 4. By customer name
 * 5. By phone number
 *
 * Deduplicates and merges all results.
 */
export async function findCustomerContext(
    senderEmail: string,
    entities: ExtractedEntities,
): Promise<CustomerContext> {
    const client = getApi();
    if (!client) {
        return { orders: [], customer: null, lookupStrategies: ['api_unavailable'], available: false };
    }

    const strategies: string[] = [];
    const allOrders: Map<number, any> = new Map();
    let customer: any = null;

    // Collect all lookup promises
    const lookups: Array<{ name: string; promise: Promise<any[]> }> = [];

    // Strategy 1: By sender email
    lookups.push({
        name: 'sender_email',
        promise: safeGet(client, 'orders', { search: senderEmail, per_page: 5 }),
    });

    // Strategy 2: By order numbers from email
    for (const orderId of entities.orderNumbers) {
        lookups.push({
            name: `order_id_${orderId}`,
            promise: safeGetSingle(client, `orders/${orderId}`),
        });
    }

    // Strategy 3: By other emails mentioned in body
    for (const email of entities.emails) {
        if (email.toLowerCase() !== senderEmail.toLowerCase()) {
            lookups.push({
                name: `body_email_${email}`,
                promise: safeGet(client, 'orders', { search: email, per_page: 3 }),
            });
        }
    }

    // Strategy 4: By customer name (if >= 3 chars to avoid false positives)
    if (entities.customerName && entities.customerName.length >= 3) {
        lookups.push({
            name: `customer_name`,
            promise: safeGet(client, 'orders', { search: entities.customerName, per_page: 3 }),
        });

        // Also try customer endpoint
        lookups.push({
            name: 'customer_search',
            promise: safeGet(client, 'customers', { search: entities.customerName, per_page: 1 }),
        });
    }

    // Strategy 5: By phone number
    for (const phone of entities.phones) {
        lookups.push({
            name: `phone_${phone}`,
            promise: safeGet(client, 'orders', { search: phone, per_page: 3 }),
        });
    }

    // Execute all lookups in parallel
    const results = await Promise.allSettled(
        lookups.map(async (lookup) => {
            const data = await lookup.promise;
            return { name: lookup.name, data };
        })
    );

    // Process results
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.data) {
            strategies.push(result.value.name);
            const items = Array.isArray(result.value.data) ? result.value.data : [result.value.data];
            for (const item of items) {
                if (item && item.id) {
                    // Check if it's a customer or an order
                    if (result.value.name === 'customer_search') {
                        customer = item;
                    } else {
                        allOrders.set(item.id, item);
                    }
                }
            }
        }
    }

    return {
        orders: Array.from(allOrders.values()),
        customer,
        lookupStrategies: strategies,
        available: true,
    };
}

/**
 * Safe wrapper for WooCommerce GET with list response.
 */
async function safeGet(client: WooCommerceRestApi<any>, endpoint: string, params: object): Promise<any[]> {
    try {
        const response = await client.get(endpoint, params);
        return response.data || [];
    } catch (error) {
        logErrorSafely(`WooCommerce GET ${endpoint}`, error);
        return [];
    }
}

/**
 * Safe wrapper for WooCommerce GET single resource.
 */
async function safeGetSingle(client: WooCommerceRestApi<any>, endpoint: string): Promise<any[]> {
    try {
        const response = await client.get(endpoint, {});
        return response.data ? [response.data] : [];
    } catch (error) {
        // 404 is expected when order doesn't exist — not an error
        const e = error as any;
        if (e?.response?.status === 404) return [];
        logErrorSafely(`WooCommerce GET ${endpoint}`, error);
        return [];
    }
}
