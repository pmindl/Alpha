import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist the mock function so it can be used inside vi.mock factory
const { mockGet } = vi.hoisted(() => {
    return { mockGet: vi.fn() };
});

// Mock the module constructor
vi.mock("woocommerce-rest-ts-api", () => {
    return {
        default: vi.fn().mockImplementation(function () {
            return {
                get: mockGet
            };
        })
    };
});

describe('WooCommerce Client', () => {
    // Save original env
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };

        // Setup default valid env
        process.env.WOOCOMMERCE_URL = 'https://example.com';
        process.env.WOOCOMMERCE_CONSUMER_KEY = 'ck_test';
        process.env.WOOCOMMERCE_CONSUMER_SECRET = 'cs_test';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should initialize api and call findCustomerOrders successfully', async () => {
        // Dynamic import to ensure fresh module and api instance
        const { findCustomerOrders } = await import('../woocommerce');

        const mockResponse = { data: [{ id: 123, total: '100.00' }] };
        mockGet.mockResolvedValue(mockResponse);

        const orders = await findCustomerOrders('test@example.com');

        expect(mockGet).toHaveBeenCalledWith('orders', {
            search: 'test@example.com',
            per_page: 5
        });
        expect(orders).toEqual(mockResponse.data);
    });

    it('should return empty array on API error', async () => {
        const { findCustomerOrders } = await import('../woocommerce');

        mockGet.mockRejectedValue(new Error('API Error'));

        const orders = await findCustomerOrders('test@example.com');

        expect(mockGet).toHaveBeenCalledWith('orders', expect.anything());
        expect(orders).toEqual([]);
    });

    it('should return empty array when WOOCOMMERCE_URL is placeholder', async () => {
        process.env.WOOCOMMERCE_URL = 'https://yourstore.com';
        const { findCustomerOrders } = await import('../woocommerce');

        const orders = await findCustomerOrders('test@example.com');

        expect(mockGet).not.toHaveBeenCalled();
        expect(orders).toEqual([]);
    });

    it('should return empty array when WOOCOMMERCE_URL is missing', async () => {
        delete process.env.WOOCOMMERCE_URL;
        const { findCustomerOrders } = await import('../woocommerce');

        const orders = await findCustomerOrders('test@example.com');

        expect(mockGet).not.toHaveBeenCalled();
        expect(orders).toEqual([]);
    });

    it('should call getOrder successfully', async () => {
        const { getOrder } = await import('../woocommerce');

        const mockResponse = { data: { id: 123, total: '100.00' } };
        mockGet.mockResolvedValue(mockResponse);

        const order = await getOrder(123);

        expect(mockGet).toHaveBeenCalledWith('orders/123', {});
        expect(order).toEqual(mockResponse.data);
    });

    it('should return null on API error in getOrder', async () => {
        const { getOrder } = await import('../woocommerce');

        mockGet.mockRejectedValue(new Error('API Error'));

        const order = await getOrder(123);

        expect(mockGet).toHaveBeenCalledWith('orders/123', {});
        expect(order).toBeNull();
    });

    it('should return null in getOrder when WOOCOMMERCE_URL is missing', async () => {
        delete process.env.WOOCOMMERCE_URL;
        const { getOrder } = await import('../woocommerce');

        const order = await getOrder(123);

        expect(mockGet).not.toHaveBeenCalled();
        expect(order).toBeNull();
    });
});
