import { NextResponse } from "next/server";

const APPS = [
    { id: 'master', name: 'Master Orchestrator', url: 'http://localhost:3000' },
    { id: 'invoice-downloader', name: 'Invoice Downloader', url: 'http://localhost:3001' },
    { id: 'invoice-processor', name: 'Invoice Processor', url: 'http://localhost:3002' },
    { id: 'gmail-labeler', name: 'Gmail Labeler', url: 'http://localhost:4003/sse' },
    { id: 'customer-responder', name: 'Customer Responder', url: 'http://localhost:3004' },
    { id: 'librechat', name: 'LibreChat Options', url: 'http://localhost:3080' }
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
