import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config(); // Load .env from root
process.chdir(path.join(process.cwd(), 'apps', 'master')); // Fix VaultManager path resolution

async function runTest() {
    const { runBrowserTask, getBrowserTaskStatus, getBrowserTaskResult } = await import("../apps/master/src/lib/browser-use");

    console.log("Starting Browser-Use Test on Seznam.cz...");

    try {
        console.log("Testing runBrowserTask (async)...");
        const taskRes = await runBrowserTask(
            "Go to https://www.seznam.cz and open 3 different news articles or links from the main page. Extract the titles of the 3 articles you opened.",
            {
                max_steps: 20,
                llm_provider: "gemini",
                allowed_domains: ["seznam.cz", "novinky.cz", "sport.cz", "super.cz", "prozeny.cz"] // common seznam domains
            }
        );

        const taskId = taskRes.task_id;
        console.log(`Task started with ID: ${taskId}`);

        let status = taskRes.state;
        while (status === "pending" || status === "running") {
            process.stdout.write(".");
            await new Promise(resolve => setTimeout(resolve, 3000));
            const statusRes = await getBrowserTaskStatus(taskId);
            status = statusRes.state;
        }

        console.log(`\nTask finished with status: ${status}`);

        const finalResult = await getBrowserTaskResult(taskId);
        console.log("\nFinal Result:", JSON.stringify(finalResult.final_result, null, 2));
        if (finalResult.errors && finalResult.errors.length > 0) {
            console.log("Errors:", finalResult.errors);
        }
        console.log("\nURLs visited:", finalResult.urls);

        console.log("\nSeznam.cz test complete!");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTest();
