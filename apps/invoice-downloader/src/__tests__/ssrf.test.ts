import { describe, it, expect } from 'vitest';
import { isValidUrl } from '../lib/ssrf';

describe('SSRF Protection', () => {
    it('should allow valid public URLs', async () => {
        // We use IP addresses to avoid DNS dependency in CI/restricted environments if possible
        expect(await isValidUrl('http://8.8.8.8')).toBe(true); // Google DNS
        expect(await isValidUrl('http://1.1.1.1')).toBe(true); // Cloudflare DNS
    });

    it('should block localhost and loopback', async () => {
        expect(await isValidUrl('http://localhost')).toBe(false);
        expect(await isValidUrl('http://127.0.0.1')).toBe(false);
        expect(await isValidUrl('http://[::1]')).toBe(false);
    });

    it('should block private IPv4 ranges', async () => {
        expect(await isValidUrl('http://10.0.0.1')).toBe(false);
        expect(await isValidUrl('http://192.168.1.1')).toBe(false);
        expect(await isValidUrl('http://172.16.0.1')).toBe(false);
        expect(await isValidUrl('http://172.31.255.255')).toBe(false);
    });

    it('should block cloud metadata IPs', async () => {
        expect(await isValidUrl('http://169.254.169.254')).toBe(false);
    });

    it('should block IPv4-mapped IPv6 addresses', async () => {
        expect(await isValidUrl('http://[::ffff:127.0.0.1]')).toBe(false);
        expect(await isValidUrl('http://[::ffff:10.0.0.1]')).toBe(false);
        expect(await isValidUrl('http://[::ffff:192.168.1.1]')).toBe(false);
        // Hex format
        expect(await isValidUrl('http://[::ffff:c0a8:0101]')).toBe(false); // 192.168.1.1 in hex
    });

    it('should allow non-private IPv4-mapped IPv6 addresses', async () => {
        // 8.8.8.8 mapped
        expect(await isValidUrl('http://[::ffff:8.8.8.8]')).toBe(true);
    });

    it('should block non-http/https protocols', async () => {
        expect(await isValidUrl('ftp://example.com')).toBe(false);
        expect(await isValidUrl('file:///etc/passwd')).toBe(false);
        expect(await isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for invalid URLs', async () => {
        expect(await isValidUrl('not-a-url')).toBe(false);
    });
});
