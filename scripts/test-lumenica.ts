import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config(); // Load .env from root
process.chdir(path.join(process.cwd(), 'apps', 'master')); // Fix VaultManager path resolution

async function runTest() {
    const { runBrowserTask, getBrowserTaskStatus, getBrowserTaskResult } = await import("../apps/master/src/lib/browser-use");

    console.log("Starting Browser-Use Test on Lumenica.cz...");

    try {
        console.log("Testing runBrowserTask (async)...");
        const taskRes = await runBrowserTask(
            "Navigate to https://lumenica.cz. Explore the site and click through at least 10 different subpages (like products, categories, about us, etc.). Scrape the necessary information and synthesize a comprehensive summary of what the site is about, what they sell, and what the key products or features are.",
            {
                max_steps: 40,
                llm_provider: "gemini",
                allowed_domains: ["lumenica.cz"]
            }
        );

        const taskId = taskRes.task_id;
        console.log(`Task started with ID: ${taskId}`);

        let status = taskRes.state;
        while (status === "pending" || status === "running") {
            process.stdout.write(".");
            await new Promise(resolve => setTimeout(resolve, 5000));
            const statusRes = await getBrowserTaskStatus(taskId);
            status = statusRes.state;
        }

        console.log(`\nTask finished with status: ${status}`);

        const finalResult = await getBrowserTaskResult(taskId);
        console.log("\nFinal Result (Summary):", JSON.stringify(finalResult.final_result, null, 2));
        if (finalResult.errors && finalResult.errors.length > 0) {
            console.log("Errors:", finalResult.errors);
        }
        console.log("\nURLs visited:", finalResult.urls);

        console.log("\nLumenica.cz test complete!");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTest();
