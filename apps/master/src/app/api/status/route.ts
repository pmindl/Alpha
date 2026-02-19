import { NextResponse } from "next/server";

const APPS = [
    { id: 'master', name: 'Master Orchestrator', url: 'http://localhost:3000' },
    { id: 'invoice-processor', name: 'Invoice Processor', url: 'http://localhost:3002' },
    { id: 'customer-responder', name: 'Customer Responder', url: 'http://localhost:3004' },
    { id: 'librechat', name: 'LibreChat Options', url: 'http://localhost:3080' } // Assuming default port
];

export async function GET() {
    const statuses = await Promise.all(APPS.map(async (app) => {
        try {
            // timeout 1s
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            const res = await fetch(app.url, {
                method: 'HEAD',
                signal: controller.signal
            }).catch(() => null);

            clearTimeout(timeoutId);

            return {
                ...app,
                status: res ? 'online' : 'offline',
                code: res ? res.status : null
            };
        } catch (e) {
            return {
                ...app,
                status: 'offline',
                error: String(e)
            };
        }
    }));

    return NextResponse.json({ apps: statuses });
}
