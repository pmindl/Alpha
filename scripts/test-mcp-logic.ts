import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { processInvoices } from '../src/lib/processor';

async function main() {
    console.log('Testing invoice processing logic...');
    try {
        const result = await processInvoices(undefined, 1); // Limit to 1 for testing
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
