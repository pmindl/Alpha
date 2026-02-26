import { POST } from '@/app/api/auth/callback/route';
import fs from 'fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
    default: {
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
    },
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
    default: {
        resolve: vi.fn().mockReturnValue('/mock/path/.env.local'),
    },
    resolve: vi.fn().mockReturnValue('/mock/path/.env.local'),
}));

describe('Auth Callback Route', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.WOOCOMMERCE_SETUP_SECRET = 'test-secret';
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should return 403 if secret is missing', async () => {
        const req = new Request('http://localhost/api/auth/callback', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('should return 403 if secret is invalid', async () => {
        const req = new Request('http://localhost/api/auth/callback?secret=wrong', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('should return 400 if keys are missing', async () => {
        const req = new Request('http://localhost/api/auth/callback?secret=test-secret', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should update .env.local with sanitized keys', async () => {
        const req = new Request('http://localhost/api/auth/callback?secret=test-secret', {
            method: 'POST',
            body: JSON.stringify({
                consumer_key: 'ck_123\nBAD',
                consumer_secret: 'cs_456\rBAD',
            }),
        });

        // Mock fs.readFileSync to throw (file doesn't exist)
        vi.mocked(fs.readFileSync).mockImplementation(() => {
            throw new Error('File not found');
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/mock/path/.env.local',
            expect.stringContaining('WOOCOMMERCE_CONSUMER_KEY=ck_123BAD')
        );
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/mock/path/.env.local',
            expect.stringContaining('WOOCOMMERCE_CONSUMER_SECRET=cs_456BAD')
        );
    });
});
