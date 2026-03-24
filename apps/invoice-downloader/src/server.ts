import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkEmails } from './lib/gmail';
import { downloadPacketaInvoices } from './lib/packeta';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Auth middleware ────────────────────────────────────────────────────────
function isAuthorized(req: express.Request): boolean {
    const authHeader = req.headers['authorization'];
    const key = req.query['key'] as string | undefined;
    const apiKey = process.env.APP_API_KEY;
    const cronSecret = process.env.CRON_SECRET;

    if (apiKey && (authHeader === `Bearer ${apiKey}` || key === apiKey)) return true;
    if (cronSecret && (authHeader === `Bearer ${cronSecret}` || key === cronSecret)) return true;
    return false;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Health check — public
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', service: 'invoice-downloader' });
});

// Root — public (needed by master status check)
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'invoice-downloader' });
});

// Ingest emails — download Gmail invoice attachments → Google Drive
app.get('/api/ingest/email', async (req, res) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        console.log('[API] /api/ingest/email triggered');
        const results = await checkEmails();
        res.json({ success: true, processed: results.length, details: results });
    } catch (error) {
        console.error('[API] Email ingestion error:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Ingest Packeta invoices — download from Packeta API → Google Drive
app.get('/api/ingest/packeta', async (req, res) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        console.log('[API] /api/ingest/packeta triggered');
        const results = await downloadPacketaInvoices();
        res.json({ success: true, count: results.length, details: results });
    } catch (error) {
        console.error('[API] Packeta ingestion error:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// ── Cron ───────────────────────────────────────────────────────────────────
async function startCron() {
    const { default: cron } = await import('node-cron');
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
    const apiKey = process.env.APP_API_KEY || '';

    // Gmail invoices every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        try {
            console.log(`[Cron] Fetching Gmail invoices at ${new Date().toISOString()}`);
            const results = await checkEmails();
            console.log(`[Cron] Gmail done — processed: ${results.length}`);
        } catch (err) {
            console.error('[Cron] Gmail invoice fetch failed:', err);
        }
    });

    // Packeta invoices every 2 hours
    cron.schedule('0 */2 * * *', async () => {
        try {
            console.log(`[Cron] Fetching Packeta invoices at ${new Date().toISOString()}`);
            const results = await downloadPacketaInvoices();
            console.log(`[Cron] Packeta done — count: ${results.length}`);
        } catch (err) {
            console.error('[Cron] Packeta fetch failed:', err);
        }
    });

    console.log(`[Cron] Scheduler started — Gmail: every 30min, Packeta: every 2h`);
}

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`[InvoiceDownloader] Express server running on port ${PORT}`);
    await startCron();
});
