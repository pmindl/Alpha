# Browser-Use Service

This microservice provides integration with the [browser-use](https://github.com/browser-use/browser-use) library for AI-driven web automation in Alpha App.

## How to run a browser-use task via Alpha App API

The Alpha App Master Node.js application acts as the gateway to this internal Python service.
You can run tasks programmatically using the bridge exported from `src/lib/browser-use.ts`:

```typescript
import { runBrowserTask, getBrowserTaskStatus, getBrowserTaskResult } from "./lib/browser-use";

// Start an async task
const { task_id } = await runBrowserTask("Go to example.com and extract the main heading", {
    max_steps: 10,
    llm_provider: "openai"
});

// The task is asynchronous, poll for completion
const status = await getBrowserTaskStatus(task_id);

// Get the final result
const result = await getBrowserTaskResult(task_id);
console.log(result.final_result);
```

### Credentials & Security

All credentials, such as the `OPENAI_API_KEY`, are fetched dynamically from Alpha App's `VaultManager`.
Do not store API keys directly in `.env` or configurations for this Python service. The Node.js application securely injects the necessary tokens into each request on a per-task basis.

## How to run tasks via MCP

The Alpha App Master MCP server registers the browser tools automatically. Any AI chat utilizing the Master App's MCP server will have access to:

1. `browser_run_task`: Starts an async autonomous agent task.
2. `browser_get_task_status`: Checks current execution status.
3. `browser_get_task_result`: Retrieves the final task results (URLs visited, exact output, errors).
4. `browser_navigate`: For precise, direct low-level Actor navigation and actions (`click`, `fill`, `screenshot`).
5. `browser_extract_content`: Uses Pydantic JSON schema to extract typed data directly from a page via the LLM.

Example prompt to an MCP-connected Agent:
> "Use the browser_run_task tool to interact with https://example.com and summarize the page content."
