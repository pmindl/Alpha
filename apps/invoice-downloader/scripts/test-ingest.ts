import { checkEmails } from '../src/lib/gmail';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log('>>> Starting isolated email ingestion test');
    try {
        const results = await checkEmails();
        console.log('>>> SUCCESS:', results.length, 'emails/attachments processed.');
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('>>> FAILED:', e);
    }
}

main();
