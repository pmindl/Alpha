import { Button } from "@alpha/ui";
import { getMcpClient } from "../lib/mcp";

export default async function Home() {
  let userContext = null;
  try {
    const client = await getMcpClient();
    // In a real scenario, we might list tools first or know the tool name
    const result = await client.callTool("get-active-user", {});
    if (result && result.content && result.content[0] && result.content[0].type === 'text') {
      userContext = JSON.parse(result.content[0].text);
    }
  } catch (e) {
    console.error("MCP Error:", e);
    userContext = { error: String(e) };
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Invoice Downloader</h1>
      <Button>Download Invoice (Shared UI)</Button>

      <div className="mt-8 p-4 border rounded bg-muted">
        <h2 className="text-xl font-bold mb-2">MCP Context (From Master)</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {JSON.stringify(userContext, null, 2)}
        </pre>
      </div>
    </div>
  );
}
