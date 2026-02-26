
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeDriveQueryString } from '../lib/utils';
import { findFile } from '../lib/drive';

// Use vi.hoisted to create the mock function so it can be used inside vi.mock factory
const { mockList } = vi.hoisted(() => {
    return { mockList: vi.fn() };
});

vi.mock('googleapis', () => {
    return {
        google: {
            drive: vi.fn(() => ({
                files: {
                    list: mockList,
                    update: vi.fn(),
                    create: vi.fn()
                }
            }))
        }
    };
});

// Mock auth (because it's imported in drive.ts)
vi.mock('../lib/auth', () => ({
    oauth2Client: {}
}));

describe('Drive Injection Protection', () => {
    beforeEach(() => {
        mockList.mockReset();
        // Default mock implementation
        mockList.mockResolvedValue({ data: { files: [] } });
    });

    it('escapes single quotes in query', () => {
        const input = "test'file.pdf";
        const expected = "test\\'file.pdf";
        expect(escapeDriveQueryString(input)).toBe(expected);
    });

    it('escapes backslashes in query', () => {
        const input = "test\\file.pdf";
        const expected = "test\\\\file.pdf";
        expect(escapeDriveQueryString(input)).toBe(expected);
    });

    it('findFile uses escaped name in query', async () => {
        const maliciousName = "malicious'name.pdf";
        const folderId = "folder123";

        await findFile(maliciousName, folderId);

        // Verify the query string contains the escaped name
        // The query should be: name = 'malicious\'name.pdf' and ...
        expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
            q: expect.stringContaining("name = 'malicious\\'name.pdf'")
        }));
    });

    it('findFile handles safe names correctly', async () => {
        const safeName = "safe_file.pdf";
        const folderId = "folder123";

        await findFile(safeName, folderId);

        expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
            q: expect.stringContaining("name = 'safe_file.pdf'")
        }));
    });
});
