import { NextResponse } from 'next/server';
import { processAllEmails } from '@/lib/agent';

// Prevent caching
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("🔄 Triggering Email Processing Pipeline...");

        const results = await processAllEmails();

        const summary = {
            message: results.length === 0 ? 'No emails to process.' : 'Processing complete.',
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            avgConfidence: results.length > 0
                ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
                : 0,
            results: results.map(r => ({
                threadId: r.threadId,
                success: r.success,
                confidence: r.confidence,
                ordersFound: r.ordersFound,
                trackingFound: r.trackingFound,
                kbArticlesUsed: r.kbArticlesUsed,
                strategies: r.lookupStrategies,
                error: r.error || undefined,
            })),
        };

        return NextResponse.json(summary);

    } catch (error) {
        console.error("Critical error in process route:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
