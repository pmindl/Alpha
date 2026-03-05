import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGoogleAuth, resetGoogleAuth } from './index';

describe('google-auth wrapper', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        resetGoogleAuth();
        process.env = { ...originalEnv };
    });

    it('should throw an error if GOOGLE_CLIENT_ID is missing', () => {
        delete process.env.GOOGLE_CLIENT_ID;
        process.env.GOOGLE_CLIENT_SECRET = 'secret';
        process.env.GOOGLE_REFRESH_TOKEN = 'refresh';

        expect(() => getGoogleAuth()).toThrowError(/Missing credentials: GOOGLE_CLIENT_ID/);
    });

    it('should initialize successfully if all credentials are present', () => {
        process.env.GOOGLE_CLIENT_ID = 'client_id';
        process.env.GOOGLE_CLIENT_SECRET = 'secret';
        process.env.GOOGLE_REFRESH_TOKEN = 'refresh';

        const auth = getGoogleAuth();
        expect(auth).toBeDefined();
        // Check if the credentials were set on the instance safely
        expect((auth as any)._clientId).toBe('client_id');
        expect((auth as any)._clientSecret).toBe('secret');
    });

    it('should act as a singleton across multiple calls', () => {
        process.env.GOOGLE_CLIENT_ID = 'client_id';
        process.env.GOOGLE_CLIENT_SECRET = 'secret';
        process.env.GOOGLE_REFRESH_TOKEN = 'refresh';

        const auth1 = getGoogleAuth();
        const auth2 = getGoogleAuth();

        expect(auth1).toBe(auth2); // exact instance match
    });
});
