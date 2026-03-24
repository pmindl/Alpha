/**
 * Next.js Instrumentation — runs once when the server starts.
 * Sets up internal cron jobs for invoice-downloader.
 *
 * Follows the same pattern as invoice-processor and customer-responder.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');

        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3001';
        const apiKey = process.env.APP_API_KEY || '';

        // Download Gmail invoices every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            try {
                console.log(`[Cron] Fetching Gmail invoices at ${new Date().toISOString()}`);
                const res = await fetch(`${baseUrl}/invoice/api/ingest/email`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                const data = await res.json();
                console.log(`[Cron] Gmail done — processed: ${data.processed ?? 0}`);
            } catch (err) {
                console.error('[Cron] Gmail invoice fetch failed:', err);
            }
        });

        // Download Packeta invoices every 2 hours
        cron.schedule('0 */2 * * *', async () => {
            try {
                console.log(`[Cron] Fetching Packeta invoices at ${new Date().toISOString()}`);
                const res = await fetch(`${baseUrl}/invoice/api/ingest/packeta`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                const data = await res.json();
                console.log(`[Cron] Packeta done — count: ${data.count ?? 0}`);
            } catch (err) {
                console.error('[Cron] Packeta invoice fetch failed:', err);
            }
        });

        console.log(
            `[Cron] Invoice Downloader scheduler started — ` +
            `Gmail: every 30min, Packeta: every 2h ` +
            `(BASE_URL: ${baseUrl})`
        );
    }
}
