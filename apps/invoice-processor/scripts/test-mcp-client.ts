
// @ts-ignore
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// @ts-ignore
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
    const transport = new StdioClientTransport({
        command: 'npm.cmd',
        args: ['run', 'mcp:start'],
    });

    const client = new Client(
        {
            name: 'test-client',
            version: '1.0.0',
        },
        {
            capabilities: {},
        }
    );

    await client.connect(transport);
    console.log('Connected to MCP Server');

    // List tools
    const tools = await client.listTools();
    console.log('Available tools:', tools.tools.map((t: any) => t.name));

    // Call get_invoice_stats tool
    console.log('Calling get_invoice_stats...');
    const statsResult = await client.callTool({
        name: 'get_invoice_stats',
        arguments: {},
    });
    console.log('Stats Result:', JSON.stringify(statsResult, null, 2));

    // Call search_invoices tool
    console.log('Calling search_invoices...');
    const searchResult = await client.callTool({
        name: 'search_invoices',
        arguments: { limit: 1 },
    });
    console.log('Search Result:', JSON.stringify(searchResult, null, 2));

    // Call process_invoices tool (dry run effectively since we don't have new files, but tests auth/path)
    console.log('Calling process_invoices...');
    // mocking processCompany interaction might be needed if side effects are unwanted, 
    // but for now we assume it's safe to run or user wants it. 
    // actually, let's just list tools to verify it's there, 
    // calling it might trigger heavy processing.
    // We will call it for a specific non-existent company to safe-test the routing
    const processResult = await client.callTool({
        name: 'process_invoices',
        arguments: { companyId: 'TEST_NON_EXISTENT' }
    });
    console.log('Process Result:', JSON.stringify(processResult, null, 2));

    await client.close();
}

main().catch(console.error);
