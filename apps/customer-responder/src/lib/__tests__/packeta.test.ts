import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { trackPacket } from '../packeta';

// Mock axios
vi.mock('axios');

describe('Packeta Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Set environment variables for testing
        process.env.PACKETA_API_PASSWORD = 'test-password';
        process.env.PACKETA_API_URL = 'https://www.zasilkovna.cz/api/rest';
    });

    it('should return null and log warning if PACKETA_API_PASSWORD is not set', async () => {
        const originalPassword = process.env.PACKETA_API_PASSWORD;
        delete process.env.PACKETA_API_PASSWORD;

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await trackPacket('12345678');

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PACKETA_API_PASSWORD not set'));

        process.env.PACKETA_API_PASSWORD = originalPassword;
    });

    it('should track packet successfully and return status data', async () => {
        const mockXmlResponse = `
            <response>
                <dateTime>2023-10-01T12:00:00</dateTime>
                <statusCode>7</statusCode>
                <statusText>Delivered</statusText>
                <branchId>123</branchId>
                <destinationBranchId>456</destinationBranchId>
                <externalTrackingCode>EXT789</externalTrackingCode>
            </response>
        `;

        vi.mocked(axios.post).mockResolvedValueOnce({
            data: mockXmlResponse
        });

        const result = await trackPacket('12345678');

        expect(result).toEqual({
            dateTime: '2023-10-01T12:00:00',
            statusCode: '7',
            statusText: 'Delivered',
            branchId: '123',
            destinationBranchId: '456',
            externalTrackingCode: 'EXT789'
        });

        expect(axios.post).toHaveBeenCalledWith(
            'https://www.zasilkovna.cz/api/rest',
            expect.stringContaining('<packetStatus>'),
            expect.objectContaining({
                headers: { 'Content-Type': 'application/xml' }
            })
        );
    });

    it('should return null when API returns a fault', async () => {
        const mockXmlFault = `
            <response>
                <fault>Incorrect API password</fault>
            </response>
        `;

        vi.mocked(axios.post).mockResolvedValueOnce({
            data: mockXmlFault
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await trackPacket('12345678');

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Packeta API Fault:'), 'Incorrect API password');
    });

    it('should return null when network error occurs', async () => {
        vi.mocked(axios.post).mockRejectedValueOnce(new Error('Connection timeout'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await trackPacket('12345678');

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error tracking packet:'), expect.any(Error));
    });

    it('should return null when response data is missing', async () => {
        vi.mocked(axios.post).mockResolvedValueOnce({
            data: '' // Empty response
        });

        const result = await trackPacket('12345678');
        expect(result).toBeNull();
    });
});
