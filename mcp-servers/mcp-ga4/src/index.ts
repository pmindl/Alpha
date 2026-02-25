import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dataClient = new BetaAnalyticsDataClient();
const adminClient = new AnalyticsAdminServiceClient();

const server = new McpServer({
    name: 'mcp-ga4',
    version: '1.0.0'
});

function getPropertyId(providedId?: string): string {
    const id = providedId || process.env.GA4_PROPERTY_ID;
    if (!id) {
        throw new Error('GA4_PROPERTY_ID is not set in environment and not provided in tool arguments.');
    }
    return `properties/${id.replace('properties/', '')}`;
}

// Tool: ga4_get_metadata
server.tool(
    'ga4_get_metadata',
    'Get metadata for available dimensions and metrics for a GA4 property.',
    {
        propertyId: z.string().optional().describe('GA4 Property ID. Defaults to env var if not provided.'),
    },
    async ({ propertyId }) => {
        try {
            const name = `${getPropertyId(propertyId)}/metadata`;
            const [metadata] = await dataClient.getMetadata({ name });
            return {
                content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error fetching metadata: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: ga4_run_report
server.tool(
    'ga4_run_report',
    'Run a customized report for a GA4 property.',
    {
        propertyId: z.string().optional(),
        dimensions: z.array(z.string()).describe('Array of dimension names, e.g., ["city", "browser"]'),
        metrics: z.array(z.string()).describe('Array of metric names, e.g., ["activeUsers", "sessions"]'),
        startDate: z.string().describe('Start date, e.g., "2023-01-01" or "30daysAgo"'),
        endDate: z.string().describe('End date, e.g., "today"'),
        limit: z.number().optional().describe('Limit the number of rows. Maximum is 2500.'),
    },
    async ({ propertyId, dimensions, metrics, startDate, endDate, limit }) => {
        try {
            const maxLimit = limit || 2500;
            if (maxLimit > 2500) {
                return {
                    content: [{ type: 'text', text: 'Row volume protection: Queries requesting more than 2,500 rows without aggregation are refused. Please use aggregation or lower the limit.' }],
                    isError: true
                };
            }

            const request = {
                property: getPropertyId(propertyId),
                dimensions: dimensions.map(d => ({ name: d })),
                metrics: metrics.map(m => ({ name: m })),
                dateRanges: [{ startDate, endDate }],
                limit: maxLimit,
            };

            const [response] = await dataClient.runReport(request);

            const headers = [
                ...(response.dimensionHeaders?.map(h => h.name) || []),
                ...(response.metricHeaders?.map(h => h.name) || [])
            ];

            const rows = response.rows?.map(row => {
                const rowData: Record<string, string> = {};
                let idx = 0;
                response.dimensionHeaders?.forEach(h => {
                    rowData[h.name!] = row.dimensionValues?.[idx]?.value || '';
                    idx++;
                });
                let mIdx = 0;
                response.metricHeaders?.forEach(h => {
                    rowData[h.name!] = row.metricValues?.[mIdx]?.value || '';
                    mIdx++;
                });
                return rowData;
            }) || [];

            return {
                content: [{ type: 'text', text: JSON.stringify({ headers, rowCount: response.rowCount, rows }, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error running report: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: ga4_realtime_report
server.tool(
    'ga4_realtime_report',
    'Run a realtime report for a GA4 property (last 30 minutes).',
    {
        propertyId: z.string().optional(),
        dimensions: z.array(z.string()).describe('Realtime dimensions, e.g., ["city"]'),
        metrics: z.array(z.string()).describe('Realtime metrics, e.g., ["activeUsers"]'),
    },
    async ({ propertyId, dimensions, metrics }) => {
        try {
            const request = {
                property: getPropertyId(propertyId),
                dimensions: dimensions.map(d => ({ name: d })),
                metrics: metrics.map(m => ({ name: m })),
            };
            const [response] = await dataClient.runRealtimeReport(request);
            return {
                content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error running realtime report: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: ga4_get_property_details
server.tool(
    'ga4_get_property_details',
    'Get property details for a GA4 property.',
    {
        propertyId: z.string().optional(),
    },
    async ({ propertyId }) => {
        try {
            const name = getPropertyId(propertyId);
            const [propertyDetails] = await adminClient.getProperty({ name });
            return {
                content: [{ type: 'text', text: JSON.stringify(propertyDetails, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error fetching property details: ${(error as Error).message}` }],
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
    console.log('New SSE connection to GA4 MCP');
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`GA4 MCP Server SSE running on port ${PORT}`);
    console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`POST Endpoint: http://localhost:${PORT}/messages`);
});
