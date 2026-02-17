import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export class NextSSEServerTransport implements Transport {
    private _controller?: ReadableStreamDefaultController<Uint8Array>;
    public stream: ReadableStream<Uint8Array>;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    constructor(public readonly sessionId: string) {
        this.stream = new ReadableStream({
            start: (controller) => {
                this._controller = controller;
                const endpointEvent = `event: endpoint\ndata: /api/mcp?sessionId=${this.sessionId}\n\n`;
                controller.enqueue(new TextEncoder().encode(endpointEvent));
            },
            cancel: () => {
                this.close();
            },
        });
    }

    async start() { }

    async close() {
        this._controller?.close();
        this.onclose?.();
    }

    async send(message: JSONRPCMessage) {
        if (!this._controller) return;
        const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
        this._controller.enqueue(new TextEncoder().encode(event));
    }

    async handlePostMessage(message: JSONRPCMessage) {
        this.onmessage?.(message);
    }
}

// Helper to wrap autonomous calls into MCP tool results
async function wrapJulesCall(fn: () => Promise<any>) {
    try {
        const result = await fn();
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
}

export class AlphaMCPServer {
    private server: McpServer;

    constructor() {
        this.server = new McpServer({
            name: "AlphaMaster",
            version: "2.0.0",
        });

        this.registerTools();
    }

    private registerTools() {
        // ============ CONTEXT TOOLS ============
        this.server.tool(
            "get-active-user",
            { placeholder: z.string().optional() },
            async () => ({
                content: [{
                    type: "text",
                    text: JSON.stringify({ id: "user_123", name: "Alpha User", role: "admin" }),
                }],
            })
        );

        // ============ JULES SESSION TOOLS ============
        this.server.tool(
            "jules-create-session",
            {
                source: z.string().describe("Source repo (e.g. sources/github/pmindl/Alpha)"),
                prompt: z.string().describe("Task description for Jules"),
                title: z.string().optional().describe("Session title"),
            },
            async ({ source, prompt, title }) => {
                const { createSession } = await import("./autonomous");
                return wrapJulesCall(() => createSession(source, prompt, title));
            }
        );

        this.server.tool(
            "jules-list-sessions",
            {},
            async () => {
                const { listSessions } = await import("./autonomous");
                return wrapJulesCall(() => listSessions());
            }
        );

        this.server.tool(
            "jules-get-session",
            { sessionId: z.string().describe("Session ID to inspect") },
            async ({ sessionId }) => {
                const { getSession } = await import("./autonomous");
                return wrapJulesCall(() => getSession(sessionId));
            }
        );

        this.server.tool(
            "jules-approve-plan",
            { sessionId: z.string().describe("Session ID to approve") },
            async ({ sessionId }) => {
                const { approvePlan } = await import("./autonomous");
                return wrapJulesCall(() => approvePlan(sessionId));
            }
        );

        this.server.tool(
            "jules-monitor-all",
            {},
            async () => {
                const { monitorAll } = await import("./autonomous");
                return wrapJulesCall(() => monitorAll());
            }
        );

        this.server.tool(
            "jules-list-sources",
            {},
            async () => {
                const { listSources } = await import("./autonomous");
                return wrapJulesCall(() => listSources());
            }
        );

        this.server.tool(
            "jules-send-message",
            {
                sessionId: z.string().describe("Session ID"),
                message: z.string().describe("Message to send to Jules"),
            },
            async ({ sessionId, message }) => {
                const { sendMessage } = await import("./autonomous");
                return wrapJulesCall(() => sendMessage(sessionId, message));
            }
        );

        this.server.tool(
            "jules-search-sessions",
            {
                query: z.string().optional().describe("Search term"),
                state: z.string().optional().describe("Filter by state (ACTIVE, COMPLETED, FAILED)"),
            },
            async ({ query, state }) => {
                const { searchSessions } = await import("./autonomous");
                return wrapJulesCall(() => searchSessions(query, state));
            }
        );

        // ============ PRESET WORKFLOWS ============
        this.server.tool(
            "start-maintenance",
            { targetRepo: z.string().optional().describe("Repository source (defaults to pmindl/Alpha)") },
            async ({ targetRepo }) => {
                const { runSystemMaintenance } = await import("./autonomous");
                return wrapJulesCall(() => runSystemMaintenance(targetRepo));
            }
        );

        this.server.tool(
            "start-security-audit",
            { targetRepo: z.string().optional().describe("Repository source (defaults to pmindl/Alpha)") },
            async ({ targetRepo }) => {
                const { runSecurityAudit } = await import("./autonomous");
                return wrapJulesCall(() => runSecurityAudit(targetRepo));
            }
        );

        this.server.tool(
            "start-code-review",
            { targetRepo: z.string().optional().describe("Repository source (defaults to pmindl/Alpha)") },
            async ({ targetRepo }) => {
                const { runCodeReview } = await import("./autonomous");
                return wrapJulesCall(() => runCodeReview(targetRepo));
            }
        );
    }

    public async connect(transport: Transport) {
        await this.server.connect(transport);
    }
}

export const mcpServer = new AlphaMCPServer();
