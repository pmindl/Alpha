import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.APP_API_KEY}`) {
        const { searchParams } = new URL(request.url);
        if (searchParams.get('key') !== process.env.APP_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    return NextResponse.json({
        status: 'ok',
        scheduler: 'active',
        time: new Date().toISOString()
    });
}
