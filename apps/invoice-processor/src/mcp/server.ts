
// @ts-ignore
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// @ts-ignore
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { db } from '@/lib/db';
import { listFiles, downloadFile } from '@/lib/gdrive';
import { processCompany } from '@/app/api/process/route';
import { getCompanies } from '@/lib/companies';

// Initialize MCP Server
const server = new McpServer({
    name: 'invoice-processor',
    version: '1.0.0',
});

// Register Tools

// Tool: list_gdrive_files
server.tool(
    'list_gdrive_files',
    'List files in the configured Google Drive folders for all companies or a specific company.',
    {
        companyId: z.string().optional().describe('Optional company ID to filter files by.'),
    },
    async ({ companyId }: { companyId?: string }) => {
        try {
            const companies = getCompanies();
            let results: any[] = [];

            for (const company of companies) {
                if (companyId && company.id !== companyId) continue;
                if (!company.gdriveFolderId) continue;

                const files = await listFiles(company.gdriveFolderId);
                results.push({
                    companyId: company.id,
                    files: files.map(f => ({ id: f.id, name: f.name }))
                });
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error listing files: ${(error as Error).message}`,
                    },
                ],
                isError: true,
            };
        }
    }
);

// Tool: search_invoices
server.tool(
    'search_invoices',
    'Search for invoices in the database.',
    {
        status: z.enum(['PENDING', 'PROCESSED', 'EXPORTED', 'ERROR', 'DUPLICATE', 'SKIPPED']).optional(),
        supplierName: z.string().optional(),
        limit: z.number().optional().default(10),
    },
    async ({ status, supplierName, limit }: { status?: 'PENDING' | 'PROCESSED' | 'EXPORTED' | 'ERROR' | 'DUPLICATE' | 'SKIPPED', supplierName?: string, limit?: number }) => {
        try {
            const where: any = {};
            if (status) where.status = status;
            if (supplierName) where.supplierName = { contains: supplierName };

            const invoices = await db.invoice.findMany({
                where,
                take: limit,
                orderBy: { createdAt: 'desc' }
            });

            return {
                content: [{ type: 'text', text: JSON.stringify(invoices, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error searching invoices: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: get_invoice_stats
server.tool(
    'get_invoice_stats',
    'Get statistics about processed invoices.',
    {},
    async () => {
        try {
            const total = await db.invoice.count();
            const byStatus = await db.invoice.groupBy({
                by: ['status'],
                _count: { status: true }
            });

            return {
                content: [{ type: 'text', text: JSON.stringify({ total, byStatus }, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error getting stats: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Tool: process_invoices
server.tool(
    'process_invoices',
    'Trigger invoice processing for all companies or a specific company.',
    {
        companyId: z.string().optional().describe('Optional company ID to process specific company.'),
    },
    async ({ companyId }: { companyId?: string }) => {
        try {
            const companies = getCompanies();
            const summary: Record<string, any> = {};

            for (const company of companies) {
                if (companyId && company.id !== companyId) continue;
                if (!company.gdriveFolderId) continue;

                summary[company.id] = await processCompany(company);
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error processing invoices: ${(error as Error).message}` }],
                isError: true
            };
        }
    }
);

// Start Server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
