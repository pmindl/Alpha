import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listUnreadEmails } from './lib/gmail';
import { processAllEmails, processEmail } from './lib/agent';
import { findCustomerOrders } from './lib/woocommerce';
import { createDraft } from './lib/gmail';
import { GetRecentOrdersSchema, DraftReplySchema } from './lib/mcp-validation';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("❌ Failed to load .env from", envPath);
} else {
    // console.error("✅ Loaded .env.local"); 
}

async function runServer() {
    const server = new Server(
        {
            name: "customer-responder",
            version: "2.0.0",
        },
        {
            capabilities: {
                resources: {},
                tools: {},
            },
        }
    );

    // Resources: Logs (placeholder for now)
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [
                {
                    uri: "responder://logs",
                    name: "Agent Logs",
                    mimeType: "text/plain",
                    description: "Recent logs from the agent (not persisted in this demo version)"
                }
            ]
        };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        if (request.params.uri === "responder://logs") {
            return {
                contents: [{
                    uri: "responder://logs",
                    mimeType: "text/plain",
                    text: "Logs are currently streaming to stdout/stderr. Check console."
                }]
            };
        }
        throw new Error("Resource not found");
    });

    // Tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "process_new_emails",
                    description: "Process emails labeled for drafting (ACTION/Prepare-reply). Extracts entities, gathers context from WooCommerce/Packeta/KB, generates AI draft replies, and applies feedback labels. Returns detailed results with confidence scores.",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
                {
                    name: "get_recent_orders",
                    description: "Fetch recent WooCommerce orders for a specific email address.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            email: { type: "string", description: "Customer email address" }
                        },
                        required: ["email"]
                    },
                },
                {
                    name: "draft_reply",
                    description: "Manually create a draft reply for a specific email thread.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            threadId: { type: "string", description: "Gmail Thread ID to reply to" },
                            message: { type: "string", description: "The content of the reply" }
                        },
                        required: ["threadId", "message"]
                    },
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        switch (request.params.name) {
            case "process_new_emails": {
                console.error("Tool: process_new_emails triggered");
                const results = await processAllEmails();

                const summary = {
                    total: results.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                    avgConfidence: results.length > 0
                        ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
                        : 0,
                    results: results.map(r => ({
                        threadId: r.threadId,
                        success: r.success,
                        confidence: r.confidence,
                        ordersFound: r.ordersFound,
                        strategies: r.lookupStrategies,
                        error: r.error,
                    })),
                };

                return {
                    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
                };
            }
            case "get_recent_orders": {
                const result = GetRecentOrdersSchema.safeParse(request.params.arguments);
                if (!result.success) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Invalid arguments: ${result.error.message}` }]
                    };
                }
                const { email } = result.data;
                console.error(`Tool: get_recent_orders for [REDACTED]`);
                const orders = await findCustomerOrders(email);
                return {
                    content: [{ type: "text", text: JSON.stringify(orders, null, 2) }]
                };
            }
            case "draft_reply": {
                const result = DraftReplySchema.safeParse(request.params.arguments);
                if (!result.success) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Invalid arguments: ${result.error.message}` }]
                    };
                }
                const { threadId, message } = result.data;
                console.error(`Tool: draft_reply for thread ${threadId}`);

                return {
                    isError: true,
                    content: [{ type: "text", text: "Tool 'draft_reply' currently requires knowledge of the recipient. Use 'process_new_emails' for automatic handling." }]
                };
            }
            default:
                throw new Error("Tool not found");
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Customer Responder MCP Server v2.0 running on stdio");
}

runServer();
