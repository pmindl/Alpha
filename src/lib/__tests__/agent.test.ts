import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEmail } from '../agent';
import * as gmail from '../gmail';
import * as woocommerce from '../woocommerce';
import * as packeta from '../packeta';
import * as knowledge from '../knowledge';

// Mock dependencies
vi.mock('../gmail');
vi.mock('../woocommerce');
vi.mock('../packeta');
vi.mock('../knowledge');

// Hoist mocks to be available in factory
const mocks = vi.hoisted(() => {
    const mockGenerateContent = vi.fn();
    const mockGetGenerativeModel = vi.fn(() => ({
        generateContent: mockGenerateContent,
    }));
    return {
        mockGenerateContent,
        mockGetGenerativeModel,
    };
});

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: vi.fn(function () {
            return {
                getGenerativeModel: mocks.mockGetGenerativeModel,
            };
        }),
    };
});

describe('Agent Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';

        // Default mock implementations
        vi.mocked(knowledge.searchKnowledgeBase).mockResolvedValue([]);
        vi.mocked(woocommerce.findCustomerOrders).mockResolvedValue([]);
        vi.mocked(gmail.createDraft).mockResolvedValue(true);
        vi.mocked(packeta.trackPacket).mockResolvedValue(null);
    });

    it('should skip processing if AI validation fails', async () => {
        mocks.mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

        const email = {
            id: '1',
            threadId: 't1',
            subject: 'Test',
            from: 'test@example.com',
            snippet: 'test',
            body: 'test',
            date: '2023-01-01'
        };

        const result = await processEmail(email);
        expect(result).toBe(false);
    });

    it('should process email and create draft successfully', async () => {
        // Setup Success Mocks
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Draft Response' }
        });

        const email = {
            id: '1',
            threadId: 't1',
            subject: 'Help',
            from: 'Customer <customer@example.com>',
            snippet: 'Help me',
            body: 'I need help',
            date: '2023-01-01'
        };

        const result = await processEmail(email);

        expect(result).toBe(true);
        expect(woocommerce.findCustomerOrders).toHaveBeenCalledWith('customer@example.com');
        expect(gmail.createDraft).toHaveBeenCalledWith('t1', 'Customer <customer@example.com>', 'Re: Help', 'Draft Response');
    });

    it('should include order context in prompt', async () => {
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Response' }
        });

        vi.mocked(woocommerce.findCustomerOrders).mockResolvedValue([
            { id: 123, status: 'processing', total: '100', currency: 'USD' }
        ]);

        const email = {
            id: '1',
            threadId: 't1',
            subject: 'Order',
            from: 'customer@example.com',
            snippet: '',
            body: '',
            date: ''
        };

        await processEmail(email);

        // Check that prompt contained order info
        // Call 0 is validateAI("hello"), Call 1 is prompt
        const promptCall = mocks.mockGenerateContent.mock.calls[1][0];
        expect(promptCall).toContain('Order #123');
        expect(promptCall).toContain('processing');
    });
});
