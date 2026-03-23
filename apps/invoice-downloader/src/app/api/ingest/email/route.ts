import { NextResponse } from 'next/server';
import { checkEmails } from '@/lib/gmail';

export const dynamic = 'force-dynamic'; // Ensure this route is never cached

export async function GET(request: Request) {
    // Simple API key check for cron usage
    const authHeader = request.headers.get('authorization');

    // Also check query param for easier manual testing
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // Secure authentication check: strictly verify that the env var is truthy before comparing
    const isCronSecretValid = process.env.CRON_SECRET && (authHeader === `Bearer ${process.env.CRON_SECRET}` || key === process.env.CRON_SECRET);
    const isApiKeyValid = process.env.APP_API_KEY && (authHeader === `Bearer ${process.env.APP_API_KEY}` || key === process.env.APP_API_KEY);

    if (!isCronSecretValid && !isApiKeyValid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const results = await checkEmails();
        return NextResponse.json({ success: true, processed: results.length, details: results });
    } catch (error) {
        console.error('Email ingestion error:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
