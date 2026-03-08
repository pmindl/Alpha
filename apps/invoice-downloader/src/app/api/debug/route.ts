import { NextResponse } from 'next/server';
import { validateGoogleAuth, getGoogleAuth } from '@alpha/google-auth';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== process.env.APP_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report: any = {
        timestamp: new Date().toISOString(),
        env: {
            GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
            GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
            PACKETA_API_KEY: !!process.env.PACKETA_API_KEY,
            PACKETA_API_PASSWORD: !!process.env.PACKETA_API_PASSWORD,
        },
        google: {},
        packeta: {}
    };

    // 1. Check Google Auth
    console.log('[Debug] Checking Google Auth...');
    try {
        const auth = await validateGoogleAuth();
        report.google.validation = auth;
        console.log('[Debug] Google Validation:', auth);
        if (auth.valid) {
            const client = getGoogleAuth();
            const token = await client.getAccessToken();
            report.google.accessTokenReceived = !!token.token;
            console.log('[Debug] Google token received:', !!token.token);
        }
    } catch (e: any) {
        report.google.error = e.message;
        console.error('[Debug] Google Error:', e.message);
    }

    // 2. Check Packeta Endpoints
    console.log('[Debug] Checking Packeta Endpoints...');
    const pKey = process.env.PACKETA_API_KEY;
    const pPass = process.env.PACKETA_API_PASSWORD;
    const pUrl = 'https://www.zasilkovna.cz/api';

    const testEndpoints = [
        '/invoice-packet.csv',
        '/rest/invoice-packet.csv',
        '/rest/invoice-list.csv',
    ];

    for (const ep of testEndpoints) {
        console.log(`[Debug] Trying Packeta EP: ${ep}`);
        try {
            const res = await axios.get(pUrl + ep, {
                params: { key: pKey, password: pPass, lang: 'cs', version: 1, from: '2024-01-01' },
                timeout: 3000
            });
            report.packeta[ep] = { status: res.status, dataPreview: typeof res.data === 'string' ? res.data.substring(0, 100) : 'binary' };
        } catch (e: any) {
            console.log(`[Debug] Packeta EP ${ep} failed: ${e.message}`);
            report.packeta[ep] = {
                status: e.response?.status,
                error: e.message,
                data: e.response?.data
            };
        }
    }

    return NextResponse.json(report);
}
