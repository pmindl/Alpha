import { NextResponse } from 'next/server';
import { processInvoices } from '@/lib/processor';

export const maxDuration = 60; // Set timeout to 60s for Vercel/Next.js

export async function GET() {
    const result = await processInvoices();

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error, detailedLogs: result.fullLogs }, { status: 500 });
    }

    return NextResponse.json(result);
}

