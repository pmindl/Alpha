import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEmail, type ProcessingResult } from '../agent';
import * as gmail from '../gmail';
import * as woocommerce from '../woocommerce';
import * as packeta from '../packeta';
import * as knowledge from '../knowledge';
import * as entityExtractor from '../entity-extractor';

// Mock dependencies
vi.mock('../gmail');
vi.mock('../woocommerce');
vi.mock('../packeta');
vi.mock('../knowledge');
vi.mock('../entity-extractor');
vi.mock('@alpha/google-auth', () => ({
    getGoogleAuth: vi.fn(() => ({})),
    getGmail: vi.fn(() => ({ users: {} })),
}));

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
        vi.mocked(woocommerce.findCustomerContext).mockResolvedValue({
            orders: [],
            customer: null,
            lookupStrategies: ['sender_email'],
            available: true,
        });
        vi.mocked(gmail.createDraft).mockResolvedValue(true);
        vi.mocked(gmail.applyFeedbackLabels).mockResolvedValue(undefined);
        vi.mocked(gmail.ensureDraftLabelsExist).mockResolvedValue(undefined);
        vi.mocked(packeta.trackAllPackets).mockResolvedValue(new Map());
        vi.mocked(entityExtractor.extractEntities).mockResolvedValue({
            orderNumbers: [],
            trackingNumbers: [],
            emails: [],
            phones: [],
            customerName: null,
        });
    });

    const makeEmail = (overrides: Partial<gmail.EmailMessage> = {}): gmail.EmailMessage => ({
        id: '1',
        threadId: 't1',
        subject: 'Test',
        from: 'test@example.com',
        snippet: 'test',
        body: 'test body',
        date: '2023-01-01',
        labels: { type: null, priority: null, action: null, status: null, finance: null },
        ...overrides,
    });

    it('should skip processing if AI validation fails', async () => {
        mocks.mockGenerateContent.mockRejectedValueOnce(new Error('API Error'));

        const email = makeEmail();
        const result = await processEmail(email);
        expect(result.success).toBe(false);
    });

    it('should process email and create draft successfully', async () => {
        // Setup Success Mocks — call 0 is validateAI, call 1 is draft generation
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Draft Response' }
        });

        const email = makeEmail({
            subject: 'Help',
            from: 'Customer <customer@example.com>',
            body: 'I need help with my order',
            labels: { type: 'Order', priority: 'Normal', action: 'Prepare-reply', status: 'New', finance: null },
        });

        const result = await processEmail(email);

        expect(result.success).toBe(true);
        expect(result.confidence).toBeGreaterThan(0);
        expect(gmail.createDraft).toHaveBeenCalledWith('t1', 'Customer <customer@example.com>', 'Re: Help', 'Draft Response');
        expect(gmail.applyFeedbackLabels).toHaveBeenCalledWith('t1', expect.objectContaining({ success: true }));
    });

    it('should include order context from multi-strategy lookup', async () => {
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Response with order context' }
        });

        vi.mocked(woocommerce.findCustomerContext).mockResolvedValue({
            orders: [{ id: 123, status: 'processing', total: '100', currency: 'CZK', date_created: '2023-01-01' }],
            customer: null,
            lookupStrategies: ['sender_email', 'order_id_123'],
            available: true,
        });

        vi.mocked(entityExtractor.extractEntities).mockResolvedValue({
            orderNumbers: [123],
            trackingNumbers: [],
            emails: [],
            phones: [],
            customerName: 'Jan Novák',
        });

        const email = makeEmail({
            from: 'customer@example.com',
            body: 'Kde je moje objednávka #123?',
        });

        const result = await processEmail(email);

        expect(result.success).toBe(true);
        expect(result.ordersFound).toBe(1);
        expect(result.lookupStrategies).toContain('sender_email');

        // Verify the prompt contained order info
        // processEmail doesn't call validateAI — only processAllEmails does
        const promptCall = mocks.mockGenerateContent.mock.calls[0][0];
        expect(promptCall).toContain('Order #123');
        expect(promptCall).toContain('processing');
    });

    it('should pass label context to the prompt', async () => {
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Response' }
        });

        const email = makeEmail({
            labels: { type: 'Complaint', priority: 'Urgent', action: 'Prepare-reply', status: 'New', finance: null },
        });

        const result = await processEmail(email);

        expect(result.success).toBe(true);
        // processEmail only calls generateContent once (for draft), no validateAI
        const promptCall = mocks.mockGenerateContent.mock.calls[0][0];
        expect(promptCall).toContain('Complaint');
        expect(promptCall).toContain('Urgent');
    });

    it('should apply failure labels when draft creation fails', async () => {
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Draft' }
        });
        vi.mocked(gmail.createDraft).mockResolvedValue(false);

        const email = makeEmail();
        const result = await processEmail(email);

        expect(result.success).toBe(false);
        expect(gmail.applyFeedbackLabels).toHaveBeenCalledWith('t1', { success: false });
    });

    it('should mark low confidence when WooCommerce is unavailable', async () => {
        mocks.mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Draft' }
        });

        vi.mocked(woocommerce.findCustomerContext).mockResolvedValue({
            orders: [],
            customer: null,
            lookupStrategies: ['api_unavailable'],
            available: false,
        });

        const email = makeEmail();
        const result = await processEmail(email);

        expect(result.success).toBe(true);
        expect(result.confidence).toBeLessThan(50);
        expect(gmail.applyFeedbackLabels).toHaveBeenCalledWith('t1', {
            success: true,
            lowConfidence: true,
        });
    });
});
