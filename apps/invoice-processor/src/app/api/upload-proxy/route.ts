import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const formData = await request.formData();
    const apiKey = process.env.APP_API_KEY || '';
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    // Forward to real upload endpoint with auth key
    try {
        const res = await fetch(`${baseUrl}/api/ingest/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                // Note: fetch automatically sets Content-Type for FormData, 
                // but we need to pass the boundary? 
                // Actually, passing FormData directly in fetch body works in Node environment if using compliant fetch.
                // Next.js fetch is compliant.
            },
            body: formData
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
