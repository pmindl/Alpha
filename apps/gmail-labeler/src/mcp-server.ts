import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import http from 'http';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execPromise = util.promisify(exec);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Parse command line arguments
function parseArgs(): { transport: 'stdio' | 'sse' } {
  const args = process.argv.slice(2);
  let transport: 'stdio' | 'sse' = 'stdio';
  
  for (const arg of args) {
    if (arg.startsWith('--transport=')) {
      const value = arg.split('=')[1];
      if (value === 'sse' || value === 'stdio') {
        transport = value;
      } else {
        console.warn(`Unknown transport: ${value}, using default: stdio`);
      }
    }
  }
  
  return { transport };
}

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
    const args = parseArgs();
    const transportType = args.transport;

    if (transportType === 'sse') {
        // SSE transport with Express
        const app = express();
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4003;
        
        // Middleware to parse JSON
        app.use(express.json());
        
        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', transport: 'sse' });
        });
        
        // SSE endpoint for MCP
        app.get('/sse', async (req, res) => {
            console.log('SSE connection requested');
            
            // Set SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Send initial connection event
            res.write('data: {"type": "connected"}\n\n');
            
            // Create SSE transport
            const transport = new SSEServerTransport('/messages', res);
            
            try {
                await server.connect(transport);
                console.log('MCP server connected via SSE');
                
                // Handle client disconnect
                req.on('close', () => {
                    console.log('SSE connection closed');
                    transport.close();
                });
            } catch (error) {
                console.error('Error connecting SSE transport:', error);
                res.status(500).end();
            }
        });
        
        // Endpoint for sending messages to the server (for POST requests)
        app.post('/messages', express.json(), async (req, res) => {
            // This endpoint is used by SSEServerTransport to receive messages from client
            // In a real implementation, the transport would handle routing these messages
            // For now, we'll acknowledge but not process
            console.log('Received message via POST');
            res.json({ received: true });
        });
        
        // Create HTTP server
        const httpServer = http.createServer(app);
        
        httpServer.listen(port, () => {
            console.log(`MCP server listening on port ${port} with SSE transport`);
            console.log(`SSE endpoint: http://localhost:${port}/sse`);
            console.log(`Health check: http://localhost:${port}/health`);
        });
        
        // Handle graceful shutdown
        const shutdown = () => {
            console.log('Shutting down SSE server...');
            httpServer.close();
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        
    } else {
        // Stdio transport (default)
        const transport = new StdioServerTransport();
        
        try {
            await server.connect(transport);
            console.log('MCP server running with stdio transport');
        } catch (error) {
            console.error('Error connecting stdio transport:', error);
            process.exit(1);
        }
    }
}

main().catch((error) => {
    console.error('Fatal error in MCP server:', error);
    process.exit(1);
});