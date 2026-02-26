import { NextResponse } from 'next/server';

// Proxy route to trigger protected actions from the dashboard without exposing keys to client
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const apiKey = process.env.APP_API_KEY || '';

    try {
        if (action === 'process') {
            await fetch(`${baseUrl}/api/process`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey }
            });
        } else if (action === 'export') {
            await fetch(`${baseUrl}/api/export`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
