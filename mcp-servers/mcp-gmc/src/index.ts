import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { z } from 'zod';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Auth setup using Application Default Credentials
const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/content']
});

const content = google.shoppingcontent({
    version: 'v2.1',
    auth: auth
});

const server = new McpServer({
    name: 'mcp-gmc',
    version: '1.0.0'
});

function getMerchantId(providedId?: string): string {
    const id = providedId || process.env.GMC_MERCHANT_ID;
    if (!id) {
        throw new Error('GMC_MERCHANT_ID is not set in environment and not provided in tool arguments.');
    }
    return id;
}

// Tool: gmc_list_products
server.tool(
    'gmc_list_products',
    'List products in Google Merchant Center.',
    {
        merchantId: z.string().optional(),
        maxResults: z.number().optional().describe('Maximum number of products to return (default 50)'),
        pageToken: z.string().optional()
    },
    async ({ merchantId, maxResults, pageToken }) => {
        try {
            const res = await content.products.list({
                merchantId: getMerchantId(merchantId),
                maxResults: maxResults || 50,
                pageToken: pageToken
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error listing products: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: gmc_get_product
server.tool(
    'gmc_get_product',
    'Get details for a single product by REST ID.',
    {
        merchantId: z.string().optional(),
        productId: z.string().describe('The REST ID of the product.')
    },
    async ({ merchantId, productId }) => {
        try {
            const res = await content.products.get({
                merchantId: getMerchantId(merchantId),
                productId: productId
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error getting product: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: gmc_get_product_issues
server.tool(
    'gmc_get_product_issues',
    'Get product statuses and identify products with issues (disapprovals or warnings).',
    {
        merchantId: z.string().optional(),
        maxResults: z.number().optional().describe('Max results to scan. Useful for finding failing products quickly.'),
    },
    async ({ merchantId, maxResults }) => {
        try {
            const res = await content.productstatuses.list({
                merchantId: getMerchantId(merchantId),
                maxResults: maxResults || 100
            });

            // Filter products that have item-level issues
            const issuesOnly = (res.data.resources || []).filter(p =>
                p.itemLevelIssues && p.itemLevelIssues.length > 0
            );

            return {
                content: [{
                    type: 'text', text: JSON.stringify({
                        nextPageToken: res.data.nextPageToken,
                        totalScanned: res.data.resources?.length || 0,
                        productsWithIssues: issuesOnly
                    }, null, 2)
                }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error getting product issues: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: gmc_get_account_status
server.tool(
    'gmc_get_account_status',
    'Get account-level status and issues.',
    {
        merchantId: z.string().optional()
    },
    async ({ merchantId }) => {
        try {
            const mId = getMerchantId(merchantId);
            const res = await content.accountstatuses.get({
                merchantId: mId,
                accountId: mId // typically the same
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error getting account status: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: gmc_list_feeds
server.tool(
    'gmc_list_feeds',
    'List data feeds and their configurations.',
    {
        merchantId: z.string().optional()
    },
    async ({ merchantId }) => {
        try {
            const res = await content.datafeeds.list({
                merchantId: getMerchantId(merchantId)
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error listing feeds: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: gmc_get_performance_report
server.tool(
    'gmc_get_performance_report',
    'Get product performance metrics (clicks, impressions, CTR) using the reports search API.',
    {
        merchantId: z.string().optional(),
        query: z.string().describe('AWQL/GAQL style query, e.g. "SELECT segments.date, metrics.clicks, metrics.impressions FROM MerchantPerformanceView WHERE segments.date DURING LAST_30_DAYS"')
    },
    async ({ merchantId, query }) => {
        try {
            const res = await content.reports.search({
                merchantId: getMerchantId(merchantId),
                requestBody: { query }
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error executing performance report: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Set up SSE transport
const app = express();
app.use(cors());
app.use(bodyParser.json());

let transport: SSEServerTransport | null = null;

app.get('/sse', async (req, res) => {
    console.log('New SSE connection to GMC MCP');
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

const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
    console.log(`GMC MCP Server SSE running on port ${PORT}`);
    console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`POST Endpoint: http://localhost:${PORT}/messages`);
});
