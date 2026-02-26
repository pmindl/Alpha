import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// This route handles the callback from WooCommerce after user approves the app.
// It receives the keys in the body (POST).

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (!process.env.WOOCOMMERCE_SETUP_SECRET || secret !== process.env.WOOCOMMERCE_SETUP_SECRET) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { user_id, consumer_key, consumer_secret, key_permissions } = body;

        if (!consumer_key || !consumer_secret) {
            return NextResponse.json({ error: 'Missing keys' }, { status: 400 });
        }

        // Sanitize inputs to prevent injection
        const safeKey = String(consumer_key).replace(/[\r\n\s]/g, '');
        const safeSecret = String(consumer_secret).replace(/[\r\n\s]/g, '');

        console.log("🔑 Received WooCommerce Keys via Webhook!");

        // Update .env.local
        const envPath = path.resolve(process.cwd(), '.env.local');
        let envContent = '';
        try {
            envContent = fs.readFileSync(envPath, 'utf-8');
        } catch (e) {
            // File likely doesn't exist, start fresh
        }

        // Replace or Append
        if (envContent.includes('WOOCOMMERCE_CONSUMER_KEY=')) {
            envContent = envContent.replace(/WOOCOMMERCE_CONSUMER_KEY=.*/g, `WOOCOMMERCE_CONSUMER_KEY=${safeKey}`);
        } else {
            envContent += `\nWOOCOMMERCE_CONSUMER_KEY=${safeKey}`;
        }

        if (envContent.includes('WOOCOMMERCE_CONSUMER_SECRET=')) {
            envContent = envContent.replace(/WOOCOMMERCE_CONSUMER_SECRET=.*/g, `WOOCOMMERCE_CONSUMER_SECRET=${safeSecret}`);
        } else {
            envContent += `\nWOOCOMMERCE_CONSUMER_SECRET=${safeSecret}`;
        }

        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log("✅ .env.local updated with new keys.");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Auth callback error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
