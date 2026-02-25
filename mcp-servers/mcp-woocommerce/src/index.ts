import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { z } from 'zod';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getWooCommerceApi(urlOverride?: string, keyOverride?: string, secretOverride?: string) {
    const url = urlOverride || process.env.WOOCOMMERCE_URL;
    const consumerKey = keyOverride || process.env.WOOCOMMERCE_CONSUMER_KEY;
    const consumerSecret = secretOverride || process.env.WOOCOMMERCE_CONSUMER_SECRET;

    if (!url || !consumerKey || !consumerSecret) {
        throw new Error('WooCommerce credentials (URL, KEY, SECRET) must be provided in environment or tool arguments.');
    }

    return new WooCommerceRestApi.default({
        url,
        consumerKey,
        consumerSecret,
        version: 'wc/v3'
    });
}

const server = new McpServer({
    name: 'mcp-woocommerce',
    version: '1.0.0'
});

// Helper for formatting API response
function formatResponse(data: any) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
}

function formatError(error: any) {
    return {
        content: [{ type: 'text', text: `WooCommerce API Error: ${error.message || error}` }],
        isError: true
    };
}

// Tool: woo_get_orders
server.tool(
    'woo_get_orders',
    'List orders with optional filters (status, date, page, etc.).',
    {
        status: z.enum(['any', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']).optional(),
        customer: z.number().optional().describe('Customer ID'),
        page: z.number().optional().describe('Page number'),
        per_page: z.number().optional().describe('Items per page (max 100)')
    },
    async ({ status, customer, page, per_page }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.get('orders', { status, customer, page, per_page });
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_get_order
server.tool(
    'woo_get_order',
    'Get full details of a single order.',
    {
        orderId: z.number().describe('The Order ID')
    },
    async ({ orderId }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.get(`orders/${orderId}`);
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_update_order_status
server.tool(
    'woo_update_order_status',
    'Update the status of an existing order.',
    {
        orderId: z.number().describe('The Order ID'),
        status: z.enum(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']).describe('New order status')
    },
    async ({ orderId, status }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.put(`orders/${orderId}`, { status });
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_get_products
server.tool(
    'woo_get_products',
    'List products with optional filters.',
    {
        status: z.string().optional(),
        category: z.string().optional().describe('Category ID'),
        in_stock: z.boolean().optional(),
        page: z.number().optional(),
        per_page: z.number().optional()
    },
    async ({ status, category, in_stock, page, per_page }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.get('products', { status, category, stock_status: in_stock ? 'instock' : undefined, page, per_page });
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_get_product
server.tool(
    'woo_get_product',
    'Get details of a single product.',
    {
        productId: z.number().describe('The Product ID')
    },
    async ({ productId }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.get(`products/${productId}`);
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_get_customers
server.tool(
    'woo_get_customers',
    'List customers with optional filters.',
    {
        email: z.string().optional(),
        role: z.string().optional(),
        page: z.number().optional(),
        per_page: z.number().optional()
    },
    async ({ email, role, page, per_page }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.get('customers', { email, role, page, per_page });
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_get_store_stats
server.tool(
    'woo_get_store_stats',
    'Get sales summary, revenue, and order counts for a given date range.',
    {
        date_min: z.string().describe('Start date (YYYY-MM-DD)'),
        date_max: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ date_min, date_max }) => {
        try {
            const api = getWooCommerceApi();
            const { data } = await api.get('reports/sales', { date_min, date_max });
            return formatResponse(data);
        } catch (error) {
            return formatError(error);
        }
    }
);

// Tool: woo_get_low_stock
server.tool(
    'woo_get_low_stock',
    'Get products that are low in stock.',
    {
        page: z.number().optional(),
        per_page: z.number().optional()
    },
    async ({ page, per_page }) => {
        try {
            const api = getWooCommerceApi();
            // WooCommerce doesn't have a direct low-stock endpoint in v3, but we can query by stock_status
            const { data } = await api.get('products', { stock_status: 'outofstock', page, per_page });
            return formatResponse({ outOfStock: data });
        } catch (error) {
            return formatError(error);
        }
    }
);

// Set up SSE transport
const app = express();
app.use(cors());
app.use(bodyParser.json());

let transport: SSEServerTransport | null = null;

app.get('/sse', async (req, res) => {
    console.log('New SSE connection to WooCommerce MCP');
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
});

app.post('/messages', async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(404).send('Session not found');
    }
});

const PORT = process.env.PORT || 8083;
app.listen(PORT, () => {
    console.log(`WooCommerce MCP Server SSE running on port ${PORT}`);
    console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`POST Endpoint: http://localhost:${PORT}/messages`);
});
