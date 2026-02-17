import { describe, it, expect, vi } from 'vitest';
import { parseInvoice } from './gemini';

// Hoist mocks to ensure they are available before imports
const mocks = vi.hoisted(() => {
    return {
        generateContent: vi.fn(),
        getGenerativeModel: vi.fn(),
    };
});

// Mock the module
vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel = mocks.getGenerativeModel.mockReturnValue({
                generateContent: mocks.generateContent
            });
        }
    };
});

describe('parseInvoice', () => {
    it('should parse a valid invoice JSON response', async () => {
        // Mock successful AI response
        const mockInvoiceData = {
            is_invoice: true,
            invoice: { number: '12345' }
        };

        mocks.generateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify(mockInvoiceData)
            }
        });

        const result = await parseInvoice('some text content');

        expect(result).toEqual(mockInvoiceData);
        // Verify the mock was called
        expect(mocks.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.0-flash' });
    });

    it('should throw error if no JSON found', async () => {
        mocks.generateContent.mockResolvedValue({
            response: {
                text: () => "I am an AI but I found no invoice data."
            }
        });

        await expect(parseInvoice('invalid content')).rejects.toThrow('No JSON found in AI response');
    });
});
