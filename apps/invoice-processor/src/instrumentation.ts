export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');

        // Poll Gmail every 15 minutes (less frequent to save API quota)
        cron.schedule('*/15 * * * *', async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002';
                await fetch(`${baseUrl}/processor/api/ingest/email`, {
                    headers: { 'Authorization': `Bearer ${process.env.APP_API_KEY}` }
                });
            } catch (err) {
                console.error('[Cron] Gmail poll failed:', err);
            }
        });

        // Process new files every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002';
                await fetch(`${baseUrl}/processor/api/process`, {
                    method: 'POST',
                    headers: { 'x-api-key': process.env.APP_API_KEY || '' }
                });
            } catch (err) {
                console.error('[Cron] Processing failed:', err);
            }
        });

        // Export pending invoices every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002';
                await fetch(`${baseUrl}/processor/api/export`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.APP_API_KEY}` }
                });
            } catch (err) {
                console.error('[Cron] Export failed:', err);
            }
        });

        console.log('Scheduler started.');
    }
}
