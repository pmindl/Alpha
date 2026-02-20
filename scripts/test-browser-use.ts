import { runBrowserTask, getBrowserTaskStatus, getBrowserTaskResult, browserNavigate } from "../apps/master/src/lib/browser-use";

async function run() {
    console.log("Starting Browser-Use Integration Test...");

    try {
        console.log("1. Testing browserNavigate...");
        const navResult = await browserNavigate("https://example.com", "screenshot");
        console.log("Navigate Result:", navResult ? "Success" : "Failed");

        console.log("\n2. Testing runBrowserTask (async)...");
        const taskRes = await runBrowserTask("Go to example.com and extract the main heading text", {
            max_steps: 10,
            llm_provider: "openai"
        });

        const taskId = taskRes.task_id;
        console.log(`Task started with ID: ${taskId}`);

        let status = taskRes.state;
        while (status === "pending" || status === "running") {
            console.log(`Status: ${status}... waiting 5s`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            const statusRes = await getBrowserTaskStatus(taskId);
            status = statusRes.state;
        }

        console.log(`Task finished with status: ${status}`);

        const finalResult = await getBrowserTaskResult(taskId);
        console.log("Final Result:", JSON.stringify(finalResult, null, 2));

        console.log("\nIntegration test complete!");
    } catch (e) {
        console.error("Integration test failed:", e);
    }
}

// To run this test, ensure the browser-use-service is running on port 3324
// and the Vault is configured with OPENAI_API_KEY.
// run();
