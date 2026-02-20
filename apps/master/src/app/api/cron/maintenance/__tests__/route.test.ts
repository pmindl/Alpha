import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import { runSystemMaintenance } from "../../../../../lib/autonomous";

vi.mock("../../../../../lib/autonomous", () => ({
    runSystemMaintenance: vi.fn(),
}));

describe("Maintenance API Route", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv, CRON_SECRET: "test-secret" };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("returns 401 if authorization header is missing", async () => {
        const req = new NextRequest("http://localhost/api/cron/maintenance");
        const response = await GET(req);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("Unauthorized");
        expect(runSystemMaintenance).not.toHaveBeenCalled();
    });

    it("returns 401 if authorization header is incorrect", async () => {
        const req = new NextRequest("http://localhost/api/cron/maintenance", {
            headers: {
                authorization: "Bearer wrong-secret",
            },
        });
        const response = await GET(req);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("Unauthorized");
        expect(runSystemMaintenance).not.toHaveBeenCalled();
    });

    it("returns 401 if CRON_SECRET is not configured", async () => {
        delete process.env.CRON_SECRET;
        const req = new NextRequest("http://localhost/api/cron/maintenance", {
            headers: {
                authorization: "Bearer undefined",
            },
        });
        const response = await GET(req);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("Unauthorized");
    });

    it("returns 200 and calls maintenance if authorization header is correct", async () => {
        vi.mocked(runSystemMaintenance).mockResolvedValue({ sessionId: "123" } as any);

        const req = new NextRequest("http://localhost/api/cron/maintenance", {
            headers: {
                authorization: "Bearer test-secret",
            },
        });
        const response = await GET(req);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.sessionId).toBe("123");
        expect(runSystemMaintenance).toHaveBeenCalled();
    });
});
