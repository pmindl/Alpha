
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execPromise = util.promisify(exec);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Create an MCP server
const server = new McpServer({
    name: 'Gmail Labeler',
    version: '1.0.0',
});

// Helper to run python script
async function runPython(mode: string, args: Record<string, any> = {}) {
    const pythonScript = path.join(process.cwd(), 'main.py');
    let cmd = `python "${pythonScript}" --mode ${mode}`;

    if (args.days) cmd += ` --days ${args.days}`;
    if (args.limit) cmd += ` --limit ${args.limit}`;
    if (args.force) cmd += ` --force`;

    // Inherit env vars so config.py can see them
    const { stdout, stderr } = await execPromise(cmd, { env: process.env });

    if (stderr && stderr.trim().length > 0) {
        // Python logging goes to stderr/files, but we might want to capture critical errors
        // mcp mode prints result to stdout, logging to stderr
        // So we don't necessarily fail on stderr unless stdout is empty/invalid
        console.error(`[Python Stderr]: ${stderr}`);
    }

    return stdout.trim();
}

// Tool: Run Email Labeler
server.tool(
    'run_email_labeler',
    {
        force_rescan: z.boolean().optional().default(false).describe('Force re-evaluation of already labeled threads'),
        thread_limit: z.number().optional().describe('Limit number of threads to process'),
        days: z.number().optional().default(14).describe('Lookback window in days'),
    },
    async ({ force_rescan, thread_limit, days }) => {
        try {
            console.error(`[MCP] Triggering labeler run...`);
            const output = await runPython('mcp', { force: force_rescan, limit: thread_limit, days });

            // Output should be JSON
            // If empty, something went wrong
            if (!output) {
                return {
                    content: [{ type: 'text', text: "Error: No output from Python script." }],
                    isError: true,
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: output,
                    },
                ],
            };
        } catch (error: any) {
            console.error(`[MCP] Error: ${error.message}`);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error executing labeler: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }
);

// Tool: Get Taxonomy
server.tool(
    'get_label_taxonomy',
    {},
    async () => {
        try {
            const output = await runPython('taxonomy');
            return {
                content: [{ type: 'text', text: output }]
            };
        } catch (error: any) {
            return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Gmail Labeler MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in MCP server:', error);
    process.exit(1);
});
