import { NextRequest, NextResponse } from "next/server";
import { mcpServer, NextSSEServerTransport } from "../../../lib/mcp";

// Map to store active transports [connectionId -> transport]
// Warning: This is in-memory and will only work if the server process is persistent (e.g. `next dev` or `next start` with a single worker).
// For serverless/edge, this will fail.
const transportMap = new Map<string, NextSSEServerTransport>();

export async function GET(req: NextRequest) {
    const sessionId = crypto.randomUUID();
    const customTransport = new NextSSEServerTransport(sessionId);

    transportMap.set(sessionId, customTransport);

    // Connect the server to this transport
    await mcpServer.connect(customTransport);

    // Return the SSE stream
    return new Response(customTransport.stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    });
}

export async function POST(req: NextRequest) {
    // Client must check the query param ?sessionId=...
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId || !transportMap.has(sessionId)) {
        return new Response(`Session not found: ${sessionId}`, { status: 404 });
    }

    const transport = transportMap.get(sessionId)!;

    try {
        const body = await req.json();
        // handlePostMessage expects the JSON-RPC message object
        await transport.handlePostMessage(body);
        return new Response("Accepted", { status: 202 });
    } catch (e) {
        console.error("MCP POST Error:", e);
        return new Response(String(e), { status: 500 });
    }
}
