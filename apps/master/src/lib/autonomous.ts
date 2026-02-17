import { z } from "zod";

const JULES_API_URL = "http://localhost:3323/mcp/execute";

// ============ GENERIC BRIDGE ============

export async function callJules(toolName: string, args: Record<string, any> = {}) {
    console.log(`[Autonomous] Calling Jules Tool: ${toolName}`, args);

    try {
        const response = await fetch(JULES_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tool: toolName,
                parameters: args,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Jules API Error (${response.status}): ${text}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[Autonomous] Failed to call Jules:", error);
        throw error;
    }
}

// ============ SESSION MANAGEMENT ============

export async function createSession(source: string, prompt: string, title?: string) {
    return await callJules("jules_create_session", {
        source,
        prompt,
        title: title || `Session-${new Date().toISOString().split('T')[0]}`,
    });
}

export async function listSessions() {
    return await callJules("jules_list_sessions");
}

export async function getSession(sessionId: string) {
    return await callJules("jules_get_session", { sessionId });
}

export async function approvePlan(sessionId: string) {
    return await callJules("jules_approve_plan", { sessionId });
}

export async function monitorAll() {
    return await callJules("jules_monitor_all");
}

export async function listSources() {
    return await callJules("jules_list_sources");
}

export async function sendMessage(sessionId: string, message: string) {
    return await callJules("jules_send_message", { sessionId, message });
}

export async function searchSessions(query?: string, state?: string) {
    return await callJules("jules_search_sessions", { query, state });
}

// ============ MAINTENANCE PRESETS ============

export async function runSystemMaintenance(targetRepo: string = "sources/github/pmindl/Alpha") {
    return await createSession(
        targetRepo,
        "PERFORM MAINTENANCE: Scan for unused imports, console.logs, and security vulnerabilities. Fix safe issues automatically.",
        `Maintenance-${new Date().toISOString().split('T')[0]}`
    );
}

export async function runSecurityAudit(targetRepo: string = "sources/github/pmindl/Alpha") {
    return await createSession(
        targetRepo,
        "SECURITY AUDIT: Check for hardcoded secrets, SQL injection vulnerabilities, XSS risks, insecure dependencies, and missing input validation. Report findings and fix critical issues.",
        `Security-Audit-${new Date().toISOString().split('T')[0]}`
    );
}

export async function runCodeReview(targetRepo: string = "sources/github/pmindl/Alpha") {
    return await createSession(
        targetRepo,
        "CODE REVIEW: Analyze code quality, check for anti-patterns, ensure proper error handling, verify TypeScript types, and suggest improvements. Create a summary report as a PR comment.",
        `Code-Review-${new Date().toISOString().split('T')[0]}`
    );
}
