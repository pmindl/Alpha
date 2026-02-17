export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');

        // Poll Gmail every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/ingest/email`, {
                    headers: { 'Authorization': `Bearer ${process.env.APP_API_KEY}` }
                });
            } catch (err) {
                console.error('[Cron] Gmail poll failed:', err);
            }
        });

        // Process new files every 3 minutes
        cron.schedule('*/3 * * * *', async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
                // Note: process route uses x-api-keyheader
                await fetch(`${baseUrl}/api/process`, {
                    method: 'POST',
                    headers: { 'x-api-key': process.env.APP_API_KEY || '' }
                });
            } catch (err) {
                console.error('[Cron] Processing failed:', err);
            }
        });

        // Export pending invoices every 10 minutes
        cron.schedule('*/10 * * * *', async () => {
            try {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/export`, {
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
