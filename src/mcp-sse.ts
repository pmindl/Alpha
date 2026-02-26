
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { processInvoices } from '@/lib/processor';

// Initialize Express App
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create an MCP server
const server = new McpServer({
    name: 'Invoice Processor',
    version: '1.0.0',
});

// Register the tool
server.tool(
    'process-pending-invoices',
    {
        query: z.string().optional().describe('Optional Gmail query to filter emails (default: subject:Antigravity -label:PROCESSED)'),
        limit: z.number().optional().default(5).describe('Maximum number of emails to process'),
    },
    async ({ query, limit }) => {
        try {
            console.error(`[MCP] Processing invoices with query="${query || 'default'}" limit=${limit}`);
            const result = await processInvoices(query, limit);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[MCP] Error: ${error.message}`);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error processing invoices: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }
);

// Tool: List Recent Emails
server.tool(
    'list-recent-emails',
    {
        query: z.string().optional().describe('Gmail query to filter emails (default: subject:Antigravity -label:PROCESSED)'),
        limit: z.number().optional().default(10).describe('Max number of emails to return'),
    },
    async ({ query, limit }) => {
        try {
            const { listMessages } = await import('@/lib/gmail');
            const q = query || 'subject:Antigravity -label:PROCESSED';
            const messages = await listMessages(q, limit);
            return {
                content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }]
            };
        } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
        }
    }
);

// Tool: Process Specific Email
server.tool(
    'process-specific-email',
    {
        messageId: z.string().describe('The ID of the Gmail message to process'),
    },
    async ({ messageId }) => {
        try {
            const { processSingleEmail } = await import('./lib/processor.js');
            const result = await processSingleEmail(messageId);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
        }
    }
);

// Tool: Get Processing Stats
server.tool(
    'get-processing-stats',
    {},
    async () => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const logPath = path.join(process.cwd(), 'logs', 'processing_decisions.json');

            if (!fs.existsSync(logPath)) {
                return { content: [{ type: 'text', text: 'No processing log found.' }] };
            }

            const logContent = fs.readFileSync(logPath, 'utf8');
            // Parse last 10 entries to avoid huge output
            const entries = logContent.trim().split('\n').slice(-10).map(line => JSON.parse(line));

            return {
                content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }]
            };
        } catch (error: any) {
            return { content: [{ type: 'text', text: `Error reading logs: ${error.message}` }], isError: true };
        }
    }
);

// Set up SSE transport
let transport: SSEServerTransport | null = null;

app.get('/sse', async (req, res) => {
    console.log('New SSE connection');
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

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Invoice-Downloader SSE Server running on port ${PORT}`);
    console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`POST Endpoint: http://localhost:${PORT}/messages`);
});
