import * as dotenv from 'dotenv';
import path from 'path';
import { processInvoices } from '../src/lib/processor';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const args = process.argv.slice(2);
    let queryArgs: string | undefined = undefined;
    let limitArg: number = 5;

    // Parse arguments
    // Usage: tsx scripts/process.ts [query] [limit]
    // Example: tsx scripts/process.ts "subject:Invoice" 10

    if (args.length > 0) {
        // If first arg is a number, treat as limit
        if (!isNaN(Number(args[0]))) {
            limitArg = Number(args[0]);
        } else {
            queryArgs = args[0];
            if (args[1] && !isNaN(Number(args[1]))) {
                limitArg = Number(args[1]);
            }
        }
    }

    console.log(`Running Invoice Processor...`);
    console.log(`Query: ${queryArgs || 'default'}`);
    console.log(`Limit: ${limitArg}`);

    try {
        const result = await processInvoices(queryArgs, limitArg);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
