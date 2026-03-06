import { listEmailsForDrafting } from './src/lib/gmail';

async function test() {
    // using the primary listing function
    const emails = await listEmailsForDrafting();
    console.log(`Found ${emails.length} actionable emails:`);
    emails.forEach(e => console.log(`- ${e.id} : ${e.subject} [${JSON.stringify(e.labels)}]`));
}

test().catch(console.error);
