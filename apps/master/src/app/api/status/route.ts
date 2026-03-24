import { NextResponse } from "next/server";

/**
 * Sub-app registry.
 * Each URL is configurable via environment variables — critical for Docker/Coolify
 * where apps run in separate containers and localhost won't work.
 *
 * Set these env vars in Coolify for this app:
 *   INVOICE_DOWNLOADER_URL=http://<coolify-fqdn>
 *   INVOICE_PROCESSOR_URL=http://<coolify-fqdn>
 *   GMAIL_LABELER_URL=http://<coolify-fqdn>
 *   CUSTOMER_RESPONDER_URL=http://<coolify-fqdn>
 *   LIBRECHAT_URL=http://<coolify-fqdn>  (optional)
 */
const APPS = [
    {
        id: 'master',
        name: 'Master Orchestrator',
        url: process.env.MASTER_URL || 'http://localhost:3000',
        healthPath: '/'
    },
    {
        id: 'invoice-downloader',
        name: 'Invoice Downloader',
        url: process.env.INVOICE_DOWNLOADER_URL || 'http://localhost:3001',
        healthPath: '/invoice'
    },
    {
        id: 'invoice-processor',
        name: 'Invoice Processor',
        url: process.env.INVOICE_PROCESSOR_URL || 'http://localhost:3002',
        healthPath: '/health'
    },
    {
        id: 'gmail-labeler',
        name: 'Gmail Labeler',
        url: process.env.GMAIL_LABELER_URL || 'http://localhost:3003',
        healthPath: '/'
    },
    {
        id: 'customer-responder',
        name: 'Customer Responder',
        url: process.env.CUSTOMER_RESPONDER_URL || 'http://localhost:3004',
        healthPath: '/'
    },
    ...(process.env.LIBRECHAT_URL ? [{
        id: 'librechat',
        name: 'LibreChat',
        url: process.env.LIBRECHAT_URL,
        healthPath: '/'
    }] : [])
];

export async function GET() {
    const statuses = await Promise.all(APPS.map(async (app) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(`${app.url}${app.healthPath}`, {
                method: 'GET',
                signal: controller.signal
            }).catch(() => null);

            clearTimeout(timeoutId);

            return {
                id: app.id,
                name: app.name,
                url: app.url,
                status: res ? 'online' : 'offline',
                code: res ? res.status : null
            };
        } catch (e) {
            return {
                id: app.id,
                name: app.name,
                url: app.url,
                status: 'offline',
                error: String(e)
            };
        }
    }));

    return NextResponse.json({ apps: statuses });
}
