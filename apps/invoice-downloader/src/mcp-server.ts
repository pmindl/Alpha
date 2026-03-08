import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { checkEmails } from './lib/gmail';
import { downloadPacketaInvoices } from './lib/packeta';

// Create an MCP server
const server = new McpServer({
    name: 'Invoice Downloader',
    version: '2.0.0',
});

// Tool: Ingest Emails
server.tool(
    'ingest-emails',
    {
        query: z.string().optional().describe('Optional Gmail query override'),
    },
    async ({ query }) => {
        try {
            console.error(`[MCP] Ingesting emails...`);
            // Note: Current checkEmails doesn't take query yet but uses env
            const results = await checkEmails();

            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully processed ${results.length} emails. Details: ${JSON.stringify(results, null, 2)}`,
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[MCP] Error: ${error.message}`);
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    }
);

// Tool: Ingest Packeta
server.tool(
    'ingest-packeta',
    {},
    async () => {
        try {
            console.error(`[MCP] Ingesting Packeta invoices...`);
            const results = await downloadPacketaInvoices();

            return {
                content: [
                    {
                        type: 'text',
                        text: `Successfully downloaded ${results.length} Packeta invoices. Details: ${JSON.stringify(results, null, 2)}`,
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[MCP] Error: ${error.message}`);
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Invoice Downloader MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in MCP server:', error);
    process.exit(1);
});
