import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";
import { EventSource } from "eventsource";

// Polyfill for Node.js environment
if (typeof global !== "undefined" && !global.EventSource) {
    // @ts-ignore
    global.EventSource = EventSource;
}

export class AlphaMCPClient {
    private client: Client;
    private transport: SSEClientTransport;

    constructor(serverUrl: string, clientName: string = "AlphaClient", clientVersion: string = "1.0.0") {
        this.transport = new SSEClientTransport(new URL(serverUrl));
        this.client = new Client(
            {
                name: clientName,
                version: clientVersion,
            },
            {
                capabilities: {},
            }
        );
    }

    async connect() {
        await this.client.connect(this.transport);
        console.log("Connected to MCP Server");
    }

    async listTools() {
        return await this.client.listTools();
    }

    async callTool(name: string, args: any) {
        return await this.client.callTool({
            name,
            arguments: args,
        });
    }
}
