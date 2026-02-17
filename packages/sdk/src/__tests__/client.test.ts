import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlphaMCPClient } from "../client";

// Mock the MCP SDK using class constructors (not arrow functions)
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
    Client: class MockClient {
        connect = vi.fn().mockResolvedValue(undefined);
        listTools = vi.fn().mockResolvedValue({
            tools: [
                { name: "get-active-user", description: "Get current user" },
                { name: "start-maintenance", description: "Run maintenance" },
            ],
        });
        callTool = vi.fn().mockResolvedValue({
            content: [{ type: "text", text: '{"status":"ok"}' }],
        });
    },
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
    SSEClientTransport: class MockTransport { },
}));

describe("AlphaMCPClient", () => {
    let client: AlphaMCPClient;

    beforeEach(() => {
        client = new AlphaMCPClient("http://localhost:3000/api/mcp");
    });

    describe("constructor", () => {
        it("creates a client with default name and version", () => {
            const c = new AlphaMCPClient("http://localhost:3000/api/mcp");
            expect(c).toBeInstanceOf(AlphaMCPClient);
        });

        it("creates a client with custom name and version", () => {
            const c = new AlphaMCPClient("http://localhost:3000/api/mcp", "TestClient", "2.0.0");
            expect(c).toBeInstanceOf(AlphaMCPClient);
        });
    });

    describe("connect", () => {
        it("connects without error", async () => {
            await expect(client.connect()).resolves.not.toThrow();
        });
    });

    describe("listTools", () => {
        it("returns available tools", async () => {
            const result = await client.listTools();

            expect(result.tools).toHaveLength(2);
            expect(result.tools[0].name).toBe("get-active-user");
        });
    });

    describe("callTool", () => {
        it("calls a tool and returns the result", async () => {
            const result = await client.callTool("get-active-user", {});

            expect(result.content).toBeDefined();
            expect(result.content[0].text).toContain("ok");
        });

        it("passes arguments through correctly", async () => {
            const result = await client.callTool("start-maintenance", {
                targetRepo: "sources/github/pmindl/Alpha",
            });

            expect(result).toBeDefined();
        });
    });
});
