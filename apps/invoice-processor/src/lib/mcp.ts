import { AlphaMCPClient } from "@alpha/sdk";

// In a real app, this URL might be dynamic or env-based
const MASTER_MCP_URL = process.env.MASTER_MCP_URL || "http://localhost:3000/api/mcp";

export const mcpClient = new AlphaMCPClient(MASTER_MCP_URL, "InvoiceProcessor");

// Helper to ensure connection
let isConnected = false;
export async function getMcpClient() {
    if (!isConnected) {
        try {
            await mcpClient.connect();
            isConnected = true;
            console.log("Connected to Master MCP");
        } catch (e) {
            console.error("Failed to connect to Master MCP:", e);
        }
    }
    return mcpClient;
}
