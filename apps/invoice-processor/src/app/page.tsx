import { Button } from "@alpha/ui";
import { getMcpClient } from "../lib/mcp";

export default async function Home() {
  let userContext = null;
  try {
    console.log("Connecting to MCP...");
    const client = await getMcpClient();
    console.log("Calling tool...");
    const result = await client.callTool("get-active-user", {});
    console.log("Tool result:", JSON.stringify(result));

    if (result && result.content && Array.isArray(result.content) && result.content[0] && (result.content[0] as any).type === 'text') {
      userContext = JSON.parse((result.content[0] as any).text);
    }
  } catch (e) {
    console.error("MCP Error:", e);
    userContext = { error: String(e) };
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Invoice Processor</h1>
      <p className="text-muted-foreground">Migrated App (Port 3002)</p>
      <Button>Process Invoice (Shared UI)</Button>

      <div className="mt-8 p-4 border rounded bg-muted w-full max-w-md overflow-auto">
        <h2 className="text-xl font-bold mb-2">MCP Context (From Master)</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {JSON.stringify(userContext, null, 2)}
        </pre>
      </div>
    </div>
  );
}
