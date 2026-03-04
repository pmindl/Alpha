import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node-cron
const mockSchedule = vi.fn();
vi.mock('node-cron', () => ({
    schedule: mockSchedule,
}));

// Mock fetch globally
const mockFetch = vi.fn();

describe('Instrumentation — Cron Scheduler', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset module registry so register() runs fresh
        vi.resetModules();
        process.env = { ...originalEnv };
        // Set up as Node.js runtime (Next.js check)
        process.env.NEXT_RUNTIME = 'nodejs';
        // Mock global fetch
        global.fetch = mockFetch as any;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should schedule a cron job when NEXT_RUNTIME is nodejs', async () => {
        const { register } = await import('../../instrumentation');
        await register();

        expect(mockSchedule).toHaveBeenCalledTimes(1);
        // Default interval is */10
        expect(mockSchedule).toHaveBeenCalledWith(
            '*/10 * * * *',
            expect.any(Function)
        );
    });

    it('should use custom interval from CRON_INTERVAL_MINUTES', async () => {
        process.env.CRON_INTERVAL_MINUTES = '15';
        const { register } = await import('../../instrumentation');
        await register();

        expect(mockSchedule).toHaveBeenCalledWith(
            '*/15 * * * *',
            expect.any(Function)
        );
    });

    it('should NOT schedule when NEXT_RUNTIME is not nodejs', async () => {
        delete process.env.NEXT_RUNTIME;
        const { register } = await import('../../instrumentation');
        await register();

        expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('should call /api/process when cron fires', async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ total: 2, successful: 2, failed: 0, avgConfidence: 75 }),
        });

        const { register } = await import('../../instrumentation');
        await register();

        // Get the callback passed to schedule
        const cronCallback = mockSchedule.mock.calls[0][1];

        // Execute the cron callback
        await cronCallback();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3004/api/process');
    });

    it('should use APP_BASE_URL when set', async () => {
        process.env.APP_BASE_URL = 'https://responder.example.com';
        mockFetch.mockResolvedValueOnce({
            json: async () => ({ total: 0, successful: 0, failed: 0 }),
        });

        const { register } = await import('../../instrumentation');
        await register();

        const cronCallback = mockSchedule.mock.calls[0][1];
        await cronCallback();

        expect(mockFetch).toHaveBeenCalledWith('https://responder.example.com/api/process');
    });

    it('should handle fetch errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const { register } = await import('../../instrumentation');
        await register();

        const cronCallback = mockSchedule.mock.calls[0][1];

        // Should NOT throw
        await expect(cronCallback()).resolves.toBeUndefined();

        expect(consoleSpy).toHaveBeenCalledWith(
            '[Cron] Email processing failed:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });
});
