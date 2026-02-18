import { NextResponse } from 'next/server';
import { listUnreadEmails } from '@/lib/gmail';
import { processEmail } from '@/lib/agent';

// Prevent caching
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("🔄 Triggering Email Processing...");

        // 1. Get Unread Emails
        const emails = await listUnreadEmails();
        console.log(`Found ${emails.length} unread emails.`);

        if (emails.length === 0) {
            return NextResponse.json({ message: 'No new emails.' });
        }

        // 2. Process each
        let processedCount = 0;
        for (const email of emails) {
            const success = await processEmail(email);
            if (success) processedCount++;
        }

        return NextResponse.json({
            message: 'Processing complete',
            found: emails.length,
            processed: processedCount
        });

    } catch (error) {
        console.error("Critical error in process route:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
