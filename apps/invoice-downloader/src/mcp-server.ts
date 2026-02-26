import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { processInvoices } from '@/lib/processor';

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

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Invoice Processor MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in MCP server:', error);
    process.exit(1);
});
