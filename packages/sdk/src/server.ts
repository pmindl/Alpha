import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Express } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { z } from "zod";

export type AlphaServerOptions = {
    name: string;
    version?: string;
    port?: number; // Required for SSE transport
    transport?: "stdio" | "sse"; // Defaults to stdio if not specified
};

export class AlphaMCPServer {
    public server: McpServer;
    private app?: Express;
    private options: AlphaServerOptions;

    constructor(options: AlphaServerOptions) {
        this.options = {
            version: "1.0.0",
            transport: "stdio",
            ...options,
        };

        this.server = new McpServer({
            name: this.options.name,
            version: this.options.version!,
        });
    }

    /**
     * Add a tool to the server
     */
    tool(name: string, description: string | undefined, schema: any, handler: (args: any) => Promise<any>) {
        if (description) {
            // Overload with description
            this.server.tool(name, description, schema, async (args: any) => {
                const result = await handler(args);
                // Standardize return format if handler returns raw data
                if (!result.content && !result.isError) {
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                return result;
            });
        } else {
            // Overload without description
            this.server.tool(name, schema, async (args: any) => {
                const result = await handler(args);
                if (!result.content && !result.isError) {
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                return result;
            });
        }
        return this;
    }

    /**
     * Start the server using the configured transport
     */
    async start() {
        const transportType = this.options.transport || "stdio";

        if (transportType === "stdio") {
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error(`[${this.options.name}] MCP Server running on stdio`);
        } else {
            if (!this.options.port) {
                throw new Error("Port is required for SSE transport");
            }
            this.startSSE(this.options.port);
        }
    }

    private startSSE(port: number) {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());

        let transport: SSEServerTransport | null = null;

        this.app.get("/sse", async (req, res) => {
            console.log(`[${this.options.name}] New SSE connection`);
            if (transport) {
                try {
                    await transport.close();
                } catch (e) { }
            }
            transport = new SSEServerTransport("/messages", res);
            await this.server.connect(transport);
        });

        this.app.post("/messages", async (req, res) => {
            console.log(`[${this.options.name}] Received POST /messages`);
            if (transport) {
                try {
                    await transport.handlePostMessage(req, res, req.body);
                } catch (err: any) {
                    console.error(`[${this.options.name}] Error handling POST message:`, err);
                    if (!res.headersSent) {
                        res.status(500).send("Internal Server Error: " + err.message);
                    }
                }
            } else {
                console.error(`[${this.options.name}] No active SSE connection!`);
                res.status(404).send("Session not found");
            }
        });

        this.app.listen(port, "0.0.0.0", () => {
            console.log(`[${this.options.name}] MCP Server running on SSE port ${port} (0.0.0.0)`);
            console.log(`SSE Endpoint: http://localhost:${port}/sse`);
        });
    }
}
