import { describe, it, expect } from "vitest";
import { AlphaMCPServer, NextSSEServerTransport } from "../mcp";

describe("AlphaMCPServer", () => {
    it("can be instantiated without errors", () => {
        expect(() => new AlphaMCPServer()).not.toThrow();
    });
});

describe("NextSSEServerTransport", () => {
    it("creates with a session ID", () => {
        const transport = new NextSSEServerTransport("test-session-123");

        expect(transport.sessionId).toBe("test-session-123");
        expect(transport.stream).toBeInstanceOf(ReadableStream);
    });

    it("start() resolves without error", async () => {
        const transport = new NextSSEServerTransport("sess");

        await expect(transport.start()).resolves.not.toThrow();
    });

    it("send() encodes a JSON-RPC message to the stream", async () => {
        const transport = new NextSSEServerTransport("sess");
        const reader = transport.stream.getReader();

        // Read the initial endpoint event
        const { value: initial } = await reader.read();
        const initStr = new TextDecoder().decode(initial);
        expect(initStr).toContain("event: endpoint");
        expect(initStr).toContain("sessionId=sess");

        // Send a message
        const message = { jsonrpc: "2.0" as const, method: "test", id: 1 };
        await transport.send(message);

        const { value: msgData } = await reader.read();
        const msgStr = new TextDecoder().decode(msgData);
        expect(msgStr).toContain("event: message");
        expect(msgStr).toContain('"method":"test"');

        reader.releaseLock();
    });

    it("handlePostMessage() triggers onmessage callback", async () => {
        const transport = new NextSSEServerTransport("sess");
        let received: any = null;

        transport.onmessage = (msg) => { received = msg; };

        const message = { jsonrpc: "2.0" as const, method: "tools/list", id: 1 };
        await transport.handlePostMessage(message);

        expect(received).toEqual(message);
    });

    it("close() triggers onclose callback", async () => {
        const transport = new NextSSEServerTransport("sess");
        let closed = false;

        transport.onclose = () => { closed = true; };

        // Read initial event to prevent stream backpressure
        const reader = transport.stream.getReader();
        await reader.read();
        reader.releaseLock();

        await transport.close();

        expect(closed).toBe(true);
    });
});
