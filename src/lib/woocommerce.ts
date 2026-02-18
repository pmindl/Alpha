import WooCommerceRestApi from "woocommerce-rest-ts-api";

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
        console.error("❌ Error fetching WooCommerce orders:", error);
        return [];
    }
}

export async function getOrder(id: number) {
    const client = getApi();
    if (!client) return null;

    try {
        const response = await client.get(`orders/${id}`, {});
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching WooCommerce order:", error);
        return null;
    }
}
