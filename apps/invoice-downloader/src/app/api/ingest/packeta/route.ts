import { NextResponse } from 'next/server';
import { downloadPacketaInvoices } from '@/lib/packeta';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    // Require CRON_SECRET or APP_API_KEY for security
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== `Bearer ${process.env.APP_API_KEY}`) {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (key !== process.env.CRON_SECRET && key !== process.env.APP_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const results = await downloadPacketaInvoices();
        return NextResponse.json({ success: true, count: results.length, details: results });
    } catch (error) {
        console.error('Packeta ingestion error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
