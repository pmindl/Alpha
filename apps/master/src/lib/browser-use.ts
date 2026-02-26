import { getVaultManager } from "./managers";

const BROWSER_USE_SERVICE_URL = process.env.BROWSER_USE_SERVICE_URL || "http://localhost:3324";

async function getApiKey(provider: string): Promise<string> {
    const vault = getVaultManager();
    const env = vault.getEnvForApp("browser-use");

    if (provider === "openai") {
        const key = env["OPENAI_API_KEY"] || vault.getCredential("OPENAI_API_KEY")?.value;
        if (!key) throw new Error("OPENAI_API_KEY not found in Vault.");
        return key;
    } else if (provider === "anthropic") {
        const key = env["ANTHROPIC_API_KEY"] || vault.getCredential("ANTHROPIC_API_KEY")?.value;
        if (!key) throw new Error("ANTHROPIC_API_KEY not found in Vault.");
        return key;
    }
    throw new Error(`Unsupported LLM provider: ${provider}`);
}

export function getBrowserUseConfig() {
    return {
        headless: process.env.BROWSER_USE_HEADLESS !== "false",
        maxSteps: parseInt(process.env.BROWSER_USE_MAX_STEPS || "100", 10),
        maxFailures: parseInt(process.env.BROWSER_USE_MAX_FAILURES || "3", 10),
        allowedDomains: process.env.BROWSER_USE_ALLOWED_DOMAINS ? process.env.BROWSER_USE_ALLOWED_DOMAINS.split(",") : undefined,
        prohibitedDomains: process.env.BROWSER_USE_PROHIBITED_DOMAINS ? process.env.BROWSER_USE_PROHIBITED_DOMAINS.split(",") : undefined,
        downloadsPath: process.env.BROWSER_USE_DOWNLOADS_PATH || undefined,
        timeoutNavigate: parseFloat(process.env.BROWSER_USE_TIMEOUT_NAVIGATE || "15.0"),
        timeoutType: parseFloat(process.env.BROWSER_USE_TIMEOUT_TYPE || "60.0"),
        waitBetweenActions: parseFloat(process.env.BROWSER_USE_WAIT_BETWEEN_ACTIONS || "0.5"),
        useVision: process.env.BROWSER_USE_USE_VISION || "auto",
    };
}

// Helper to interact with the Python Service
async function callBrowserService(endpoint: string, data: any) {
    const response = await fetch(`${BROWSER_USE_SERVICE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        let errStr = response.statusText;
        try {
            const errData = await response.json();
            if (errData.detail) errStr = errData.detail;
        } catch (e) { }
        throw new Error(`Browser API Error (${response.status}): ${errStr}`);
    }

    return await response.json();
}

async function fetchBrowserServiceGet(endpoint: string) {
    const response = await fetch(`${BROWSER_USE_SERVICE_URL}${endpoint}`);

    if (!response.ok) {
        let errStr = response.statusText;
        try {
            const errData = await response.json();
            if (errData.detail) errStr = errData.detail;
        } catch (e) { }
        throw new Error(`Browser API Error (${response.status}): ${errStr}`);
    }

    return await response.json();
}

// ============ TASK OPERATIONS ============

export async function runBrowserTask(
    task: string,
    options: {
        max_steps?: number;
        allowed_domains?: string[];
        output_schema?: any;
        llm_provider?: string;
    } = {}
) {
    const config = getBrowserUseConfig();
    const llmProvider = options.llm_provider || "openai";
    const apiKey = await getApiKey(llmProvider);

    // Merge configurations globally and per task. Note Python side isn't fully using all globals right now, but we send them.
    const allowed_domains = options.allowed_domains || config.allowedDomains;

    return await callBrowserService("/task", {
        task,
        max_steps: options.max_steps || config.maxSteps,
        allowed_domains,
        output_schema: options.output_schema,
        llm_provider: llmProvider,
        api_key: apiKey,
        headless: config.headless,
    });
}

export async function getBrowserTaskStatus(taskId: string) {
    return await fetchBrowserServiceGet(`/task/${taskId}`);
}

export async function getBrowserTaskResult(taskId: string) {
    return await fetchBrowserServiceGet(`/task/${taskId}/result`);
}

// ============ ACTOR OPERATIONS ============

export async function browserExtractContent(
    url: string,
    extraction_prompt: string,
    output_schema: any,
    llm_provider: string = "openai"
) {
    const config = getBrowserUseConfig();
    const apiKey = await getApiKey(llm_provider);

    return await callBrowserService("/actor/extract", {
        url,
        extraction_prompt,
        output_schema,
        llm_provider,
        api_key: apiKey,
        headless: config.headless,
    });
}

export async function browserNavigate(
    url: string,
    action?: string,
    selector?: string,
    text?: string
) {
    const config = getBrowserUseConfig();

    return await callBrowserService("/actor/navigate", {
        url,
        action,
        selector,
        text,
        headless: config.headless,
    });
}
