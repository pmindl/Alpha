/**
 * Next.js Instrumentation — runs once when the server starts.
 * Sets up cron jobs for automated email processing.
 * 
 * Follows the same pattern as invoice-processor/src/instrumentation.ts.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');

        const interval = process.env.CRON_INTERVAL_MINUTES || '10';

        // Process labeled emails (draft replies) at configured interval
        cron.schedule(`*/${interval} * * * *`, async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3004';
                console.log(`[Cron] Processing emails at ${new Date().toISOString()}`);

                const res = await fetch(`${baseUrl}/api/process`);
                const data = await res.json();

                console.log(
                    `[Cron] Done — ${data.successful ?? 0}/${data.total ?? 0} drafts created` +
                    (data.avgConfidence ? ` (avg confidence: ${data.avgConfidence}%)` : '')
                );
            } catch (err) {
                console.error('[Cron] Email processing failed:', err);
            }
        });

        console.log(
            `[Cron] Scheduler started — processing emails every ${interval} min` +
            ` (BASE_URL: ${process.env.APP_BASE_URL || 'http://localhost:3004'})`
        );
    }
}
