import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callJules, createSession, runSystemMaintenance, runSecurityAudit, runCodeReview } from "../autonomous";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("autonomous - Jules Bridge", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        vi.spyOn(console, "log").mockImplementation(() => { });
        vi.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("callJules", () => {
        it("sends correct payload format", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            await callJules("jules_create_session", { source: "test", prompt: "hello" });

            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:3323/mcp/execute",
                expect.objectContaining({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool: "jules_create_session",
                        parameters: { source: "test", prompt: "hello" },
                    }),
                })
            );
        });

        it("uses 'parameters' key (not 'arguments')", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            await callJules("test_tool", { key: "value" });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body).toHaveProperty("parameters");
            expect(body).not.toHaveProperty("arguments");
        });

        it("throws on non-OK response", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => "Internal Server Error",
            });

            await expect(callJules("bad_tool")).rejects.toThrow("Jules API Error (500)");
        });

        it("throws on network failure", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network failed"));

            await expect(callJules("any_tool")).rejects.toThrow("Network failed");
        });
    });

    describe("createSession", () => {
        it("calls jules_create_session with correct args", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ sessionId: "123" }),
            });

            await createSession("sources/github/pmindl/Alpha", "Fix bugs", "My Session");

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.tool).toBe("jules_create_session");
            expect(body.parameters.source).toBe("sources/github/pmindl/Alpha");
            expect(body.parameters.prompt).toBe("Fix bugs");
            expect(body.parameters.title).toBe("My Session");
        });

        it("generates a default title when none provided", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            await createSession("source", "prompt");

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.parameters.title).toMatch(/^Session-\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe("preset workflows", () => {
        beforeEach(() => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ sessionId: "preset-123" }),
            });
        });

        it("runSystemMaintenance uses default repo", async () => {
            await runSystemMaintenance();

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.parameters.source).toBe("sources/github/pmindl/Alpha");
            expect(body.parameters.prompt).toContain("MAINTENANCE");
        });

        it("runSystemMaintenance accepts custom repo", async () => {
            await runSystemMaintenance("sources/github/test/repo");

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.parameters.source).toBe("sources/github/test/repo");
        });

        it("runSecurityAudit uses correct prompt", async () => {
            await runSecurityAudit();

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.parameters.prompt).toContain("SECURITY AUDIT");
        });

        it("runCodeReview uses correct prompt", async () => {
            await runCodeReview();

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.parameters.prompt).toContain("CODE REVIEW");
        });
    });
});
