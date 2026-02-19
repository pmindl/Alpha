
import dotenv from 'dotenv';
import path from 'path';
import { listUnreadEmails, getGmailClient } from '../src/lib/gmail';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runCallback() {
    console.log("🔍 Testing Gmail Connection...");

    try {
        // Get client via the new exported function
        const gmail = getGmailClient();

        const resLabels = await gmail.users.labels.list({ userId: 'me' });
        console.log("📂 Labels:", resLabels.data.labels?.map((l: any) => l.name).join(', '));

        console.log("\n🔍 Checking UNREAD in INBOX...");
        const emails = await listUnreadEmails();
        console.log(`Found ${emails.length} unread emails.`);
        emails.forEach(e => {
            console.log(`- [${e.id}] ${e.subject} (${e.from})`);
        });

    } catch (error: any) {
        console.error("❌ Failed:", error.message || error);
    }
} // End runCallback

runCallback();
