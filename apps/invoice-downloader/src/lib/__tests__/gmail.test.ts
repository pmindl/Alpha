import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listMessages, getMessage, getAttachment, addLabel } from '../gmail';
import { google } from 'googleapis';

const mockGmail = {
    users: {
        messages: {
            list: vi.fn(),
            get: vi.fn(),
            modify: vi.fn(),
            attachments: {
                get: vi.fn()
            }
        },
        labels: {
            list: vi.fn()
        }
    }
};

vi.mock('googleapis', () => ({
    google: {
        gmail: vi.fn(() => mockGmail)
    }
}));

vi.mock('@alpha/google-auth', () => ({
    getGoogleAuth: vi.fn(() => ({
        getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' })
    }))
}));

describe('Gmail Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should list messages based on query', async () => {
        mockGmail.users.messages.list.mockResolvedValue({
            data: { messages: [{ id: 'msg1' }, { id: 'msg2' }] }
        });

        const messages = await listMessages('test-query', 10);
        expect(messages).toHaveLength(2);
        expect(mockGmail.users.messages.list).toHaveBeenCalledWith({
            userId: 'me',
            q: 'test-query',
            maxResults: 10
        });
    });

    it('should fetch message details and map correctly', async () => {
        mockGmail.users.messages.get.mockResolvedValue({
            data: {
                id: 'msg1',
                payload: {
                    headers: [
                        { name: 'Subject', value: 'Test Subject' },
                        { name: 'From', value: 'sender@example.com' },
                        { name: 'Date', value: '2024-03-01' }
                    ],
                    parts: [
                        { mimeType: 'text/plain', body: { data: Buffer.from('Body').toString('base64') } },
                        { filename: 'invoice.pdf', body: { attachmentId: 'att1' }, mimeType: 'application/pdf' }
                    ]
                }
            }
        });

        const msg = await getMessage('msg1');
        expect(msg?.subject).toBe('Test Subject');
        expect(msg?.attachments).toHaveLength(1);
        expect(msg?.attachments[0].filename).toBe('invoice.pdf');
    });

    it('should add PROCESSED label', async () => {
        mockGmail.users.labels.list.mockResolvedValue({ data: { labels: [{ name: 'PROCESSED', id: 'L1' }] } });
        mockGmail.users.messages.modify.mockResolvedValue({});

        await addLabel('msg1', 'PROCESSED');
        expect(mockGmail.users.messages.modify).toHaveBeenCalled();
    });
});
