import { AlphaMCPServer } from "@alpha/sdk";
import { z } from "zod";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class NextSSEServerTransport implements Transport {
    public sessionId: string;
    public stream: ReadableStream;
    private controller!: ReadableStreamDefaultController;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.stream = new ReadableStream({
            start: (controller) => {
                this.controller = controller;
                const initData = `event: endpoint\ndata: /api/mcp?sessionId=${this.sessionId}\n\n`;
                controller.enqueue(new TextEncoder().encode(initData));
            },
            cancel: () => {
                this.onclose?.();
            }
        });
    }

    async start(): Promise<void> { }

    async send(message: JSONRPCMessage): Promise<void> {
        const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
        this.controller.enqueue(new TextEncoder().encode(data));
    }

    async close(): Promise<void> {
        try {
            this.controller.close();
        } catch (e) {
            // Already closed
        }
        this.onclose?.();
    }

    async handlePostMessage(message: JSONRPCMessage): Promise<void> {
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

// Helper to wrap browser service calls into MCP tool results
async function wrapBrowserCall(fn: () => Promise<any>) {
    try {
        const result = await fn();
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
}

export function createMCPServer() {
    const server = new AlphaMCPServer({
        name: "AlphaMaster",
        version: "2.0.0",
        transport: "sse",
        port: 3000
    });

    // ============ CONTEXT TOOLS ============
    server.tool(
        "get-active-user",
        "Get information about the active user",
        { placeholder: z.string().optional() },
        async () => ({
            id: "user_123", name: "Alpha User", role: "admin"
        })
    );

    // ============ JULES SESSION TOOLS ============
    server.tool(
        "jules-create-session",
        "Create a new autonomous coding session",
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

    server.tool(
        "jules-list-sessions",
        "List all active sessions",
        {},
        async () => {
            const { listSessions } = await import("./autonomous");
            return wrapJulesCall(() => listSessions());
        }
    );

    server.tool(
        "jules-get-session",
        "Get details of a specific session",
        { sessionId: z.string().describe("Session ID to inspect") },
        async ({ sessionId }) => {
            const { getSession } = await import("./autonomous");
            return wrapJulesCall(() => getSession(sessionId));
        }
    );

    server.tool(
        "jules-approve-plan",
        "Approve the plan for a session",
        { sessionId: z.string().describe("Session ID to approve") },
        async ({ sessionId }) => {
            const { approvePlan } = await import("./autonomous");
            return wrapJulesCall(() => approvePlan(sessionId));
        }
    );

    server.tool(
        "jules-monitor-all",
        "Monitor all sessions",
        {},
        async () => {
            const { monitorAll } = await import("./autonomous");
            return wrapJulesCall(() => monitorAll());
        }
    );

    server.tool(
        "jules-list-sources",
        "List available code sources",
        {},
        async () => {
            const { listSources } = await import("./autonomous");
            return wrapJulesCall(() => listSources());
        }
    );

    server.tool(
        "jules-send-message",
        "Send a message to a session",
        {
            sessionId: z.string().describe("Session ID"),
            message: z.string().describe("Message to send to Jules"),
        },
        async ({ sessionId, message }) => {
            const { sendMessage } = await import("./autonomous");
            return wrapJulesCall(() => sendMessage(sessionId, message));
        }
    );

    server.tool(
        "jules-search-sessions",
        "Search for sessions",
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
    server.tool(
        "start-maintenance",
        "Start system maintenance workflow",
        { targetRepo: z.string().optional().describe("Repository source (defaults to pmindl/Alpha)") },
        async ({ targetRepo }) => {
            const { runSystemMaintenance } = await import("./autonomous");
            return wrapJulesCall(() => runSystemMaintenance(targetRepo));
        }
    );

    server.tool(
        "start-security-audit",
        "Start security audit workflow",
        { targetRepo: z.string().optional().describe("Repository source (defaults to pmindl/Alpha)") },
        async ({ targetRepo }) => {
            const { runSecurityAudit } = await import("./autonomous");
            return wrapJulesCall(() => runSecurityAudit(targetRepo));
        }
    );

    server.tool(
        "start-code-review",
        "Start code review workflow",
        { targetRepo: z.string().optional().describe("Repository source (defaults to pmindl/Alpha)") },
        async ({ targetRepo }) => {
            const { runCodeReview } = await import("./autonomous");
            return wrapJulesCall(() => runCodeReview(targetRepo));
        }
    );

    // ============ BROWSER USE TOOLS ============
    server.tool(
        "browser_run_task",
        "Start an autonomous browser task",
        {
            task: z.string().describe("Task description for the browser agent"),
            max_steps: z.number().optional().describe("Maximum number of steps"),
            allowed_domains: z.array(z.string()).optional().describe("Allowed domains for navigation"),
            llm_provider: z.string().optional().describe("LLM Provider (openai/anthropic)"),
        },
        async ({ task, max_steps, allowed_domains, llm_provider }) => {
            const { runBrowserTask } = await import("./browser-use");
            return wrapBrowserCall(() => runBrowserTask(task, { max_steps, allowed_domains, llm_provider }));
        }
    );

    server.tool(
        "browser_get_task_status",
        "Get the status of a running browser task",
        { task_id: z.string().describe("Task ID to get status for") },
        async ({ task_id }) => {
            const { getBrowserTaskStatus } = await import("./browser-use");
            return wrapBrowserCall(() => getBrowserTaskStatus(task_id));
        }
    );

    server.tool(
        "browser_get_task_result",
        "Get the results of a completed browser task",
        { task_id: z.string().describe("Task ID to get results for") },
        async ({ task_id }) => {
            const { getBrowserTaskResult } = await import("./browser-use");
            return wrapBrowserCall(() => getBrowserTaskResult(task_id));
        }
    );

    server.tool(
        "browser_extract_content",
        "Extract structured content from a webpage",
        {
            url: z.string().describe("URL to navigate to"),
            extraction_prompt: z.string().describe("Instruction for extracting content"),
            output_schema_json: z.string().describe("Pydantic JSON Schema for output format"),
        },
        async ({ url, extraction_prompt, output_schema_json }) => {
            const { browserExtractContent } = await import("./browser-use");
            let outputSchema = {};
            try {
                outputSchema = JSON.parse(output_schema_json);
            } catch (e) {
                return { content: [{ type: "text" as const, text: `Schema formatting error: ${e}` }], isError: true };
            }
            return wrapBrowserCall(() => browserExtractContent(url, extraction_prompt, outputSchema));
        }
    );

    server.tool(
        "browser_navigate",
        "Navigate to a URL and optionally perform an action",
        {
            url: z.string().describe("URL to navigate to"),
            action: z.string().optional().describe("Action to perform after navigation (click, fill, screenshot)"),
            selector: z.string().optional().describe("CSS Selector for the action"),
            text: z.string().optional().describe("Text to fill (if action is fill)"),
        },
        async ({ url, action, selector, text }) => {
            const { browserNavigate } = await import("./browser-use");
            return wrapBrowserCall(() => browserNavigate(url, action, selector, text));
        }
    );

    return server;
}
