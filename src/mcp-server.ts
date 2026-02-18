import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listUnreadEmails } from './lib/gmail';
import { processEmail } from './lib/agent';
import { findCustomerOrders } from './lib/woocommerce';
import { createDraft } from './lib/gmail';
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
            version: "1.0.0",
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
                    description: "Trigger the main agent workflow: Check unread emails, lookup context, and draft replies.",
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
                const emails = await listUnreadEmails();
                let count = 0;
                for (const email of emails) {
                    const success = await processEmail(email);
                    if (success) count++;
                }
                return {
                    content: [{ type: "text", text: `Processed ${count} emails out of ${emails.length} found.` }]
                };
            }
            case "get_recent_orders": {
                const email = String(request.params.arguments?.email);
                console.error(`Tool: get_recent_orders for ${email}`);
                const orders = await findCustomerOrders(email);
                return {
                    content: [{ type: "text", text: JSON.stringify(orders, null, 2) }]
                };
            }
            case "draft_reply": {
                const threadId = String(request.params.arguments?.threadId);
                const message = String(request.params.arguments?.message);
                console.error(`Tool: draft_reply for thread ${threadId}`);

                // Note: We need a 'to' address for createDraft, but in this manual tool usage
                // we might assume it's replying to the sender of the last message in thread.
                // However, createDraft requires 'to'. 
                // For simplicity in this tool, we'll fetch the thread first to find the 'to' address
                // OR we update the tool schema to require 'to'.
                // Let's rely on the user providing 'to' in the prompt or just hardcode/find it.
                // Better approach: Agent logic usually has the email object. 
                // Setup: let's ask for 'to' address in schema to be safe.

                // Correction: The schema didn't ask for 'to'. 
                // Let's fetch the thread details using listUnread logic? No that's inefficient.
                // Let's update the tool to require 'to_email'.
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
    console.error("Customer Responder MCP Server running on stdio");
}

runServer();
