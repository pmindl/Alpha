import { AlphaMCPClient } from "../packages/sdk/src/client";
import { EventSource } from "eventsource";

// Polyfill EventSource for Node.js
// @ts-ignore
global.EventSource = EventSource;

async function main() {
    console.log("Connecting to MCP Server at http://localhost:3000/api/mcp...");

    const client = new AlphaMCPClient("http://localhost:3000/api/mcp");

    try {
        await client.connect();
        console.log("Connected successfully!");

        const tools = await client.listTools();
        console.log("Tools available:", tools);

        // Call the test tool
        const result = await client.callTool("get-active-user", {});
        console.log("Tool Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Connection failed:", error);
    }
}

main();
