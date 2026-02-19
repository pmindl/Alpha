import { NextRequest, NextResponse } from "next/server";
import { getContextManager } from "../../../lib/managers";
import { ContextItemSchema } from "@alpha/core";

export async function GET() {
    try {
        const manager = getContextManager();
        const contexts = manager.listContexts();
        return NextResponse.json(contexts);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Allow adding multiple contexts if body is array, or single if object
        // But for simplicity, let's assume single item for now or check
        const item = ContextItemSchema.parse(body);
        const manager = getContextManager();
        manager.addContext(item);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }
        const manager = getContextManager();
        const removed = manager.removeContext(id);
        if (removed) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Context not found" }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
