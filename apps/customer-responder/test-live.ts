/**
 * Test script v3: Fetch 3 random emails and run the customer-responder pipeline.
 * Excludes all previously tested threads.
 */
import { listUnreadEmails, type EmailMessage } from './src/lib/gmail';
import { processEmail } from './src/lib/agent';
import { extractEntitiesRegex } from './src/lib/entity-extractor';

// All threads tested so far
const EXCLUDE_THREADS = new Set([
    '19cb35f7f8a463e7', '19caf36d05c7c6d7', '19cb310f58154b3f',
    '19cb30d1c3f4c345', '19caea53305ac1cb', '19cb2a124e1510fb',
]);

async function main() {
    console.log('\n🧪 Customer Responder v2.0 — Live Test v3 (3 new emails)');
    console.log('═'.repeat(60));

    const allEmails = await listUnreadEmails('INBOX');
    console.log(`📬 Found ${allEmails.length} unread emails. Excluding ${EXCLUDE_THREADS.size} previously tested.`);

    const emails = allEmails.filter(e => !EXCLUDE_THREADS.has(e.threadId));
    console.log(`   Available: ${emails.length}`);

    if (emails.length === 0) {
        console.error('❌ No new emails found.');
        return;
    }

    const selected = [...emails].sort(() => 0.5 - Math.random()).slice(0, 3);

    for (let i = 0; i < selected.length; i++) {
        const email = selected[i];
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`📧 Email ${i + 1}/${selected.length} (Thread: ${email.threadId})`);
        console.log('═'.repeat(60));
        console.log(`   From:    ${email.from}`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   Date:    ${email.date}`);
        console.log(`   Body:    ${email.body.substring(0, 250).replace(/[\n\r]+/g, ' ')}...`);

        // Regex entity extraction
        const ent = extractEntitiesRegex(email.body, email.from);
        console.log(`\n🔍 Entities: orders=[${ent.orderNumbers}] tracking=[${ent.trackingNumbers}] emails=[${ent.emails}] phones=[${ent.phones}] name=${ent.customerName || '-'}`);

        // Full pipeline
        console.log(`\n🤖 Running pipeline...`);
        try {
            const r = await processEmail(email);
            console.log(`\n📊 ${r.success ? '✅' : '❌'} | Confidence: ${r.confidence}% | Orders: ${r.ordersFound} | Tracking: ${r.trackingFound} | KB: ${r.kbArticlesUsed} | Strategies: [${r.lookupStrategies}]`);
            if (r.error) console.log(`   Error: ${r.error}`);
        } catch (e: any) {
            console.error(`❌ Pipeline error:`, e.message);
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('🏁 Test complete!');
}

main().catch(console.error);
