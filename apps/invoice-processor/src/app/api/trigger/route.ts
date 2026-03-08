import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002';
    const apiKey = process.env.APP_API_KEY || '';

    if (!action) {
        return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    try {
        let res;
        if (action === 'process') {
            res = await fetch(`${baseUrl}/processor/api/process`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey }
            });
        } else if (action === 'export') {
            res = await fetch(`${baseUrl}/processor/api/export`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error(`Trigger API Error (${action}):`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
