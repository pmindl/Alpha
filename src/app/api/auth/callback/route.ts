import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// This route handles the callback from WooCommerce after user approves the app.
// It receives the keys in the body (POST).

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id, consumer_key, consumer_secret, key_permissions } = body;

        if (!consumer_key || !consumer_secret) {
            return NextResponse.json({ error: 'Missing keys' }, { status: 400 });
        }

        console.log("🔑 Received WooCommerce Keys via Webhook!");

        // Update .env.local
        const envPath = path.resolve(process.cwd(), '.env.local');
        let envContent = fs.readFileSync(envPath, 'utf-8');

        // Replace or Append
        // Naive replacement for now
        if (envContent.includes('WOOCOMMERCE_CONSUMER_KEY=')) {
            envContent = envContent.replace(/WOOCOMMERCE_CONSUMER_KEY=.*/g, `WOOCOMMERCE_CONSUMER_KEY=${consumer_key}`);
        } else {
            envContent += `\nWOOCOMMERCE_CONSUMER_KEY=${consumer_key}`;
        }

        if (envContent.includes('WOOCOMMERCE_CONSUMER_SECRET=')) {
            envContent = envContent.replace(/WOOCOMMERCE_CONSUMER_SECRET=.*/g, `WOOCOMMERCE_CONSUMER_SECRET=${consumer_secret}`);
        } else {
            envContent += `\nWOOCOMMERCE_CONSUMER_SECRET=${consumer_secret}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log("✅ .env.local updated with new keys.");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Auth callback error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
