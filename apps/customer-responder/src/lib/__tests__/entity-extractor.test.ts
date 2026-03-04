import { describe, it, expect } from 'vitest';
import { extractEntitiesRegex } from '../entity-extractor';

describe('Entity Extractor — Regex', () => {
    describe('Order Numbers', () => {
        it('should extract order number with # prefix', () => {
            const result = extractEntitiesRegex('My order #1234 is delayed', 'Jan <jan@example.com>');
            expect(result.orderNumbers).toContain(1234);
        });

        it('should extract Czech-style order reference', () => {
            const result = extractEntitiesRegex('Objednávka 5678 nebyla doručena', 'jan@test.cz');
            expect(result.orderNumbers).toContain(5678);
        });

        it('should extract "obj. č." format', () => {
            const result = extractEntitiesRegex('Dotaz k obj. č. 9012', 'jan@test.cz');
            expect(result.orderNumbers).toContain(9012);
        });

        it('should handle multiple order numbers', () => {
            const result = extractEntitiesRegex('Orders #100 and #200', 'user@test.com');
            expect(result.orderNumbers).toContain(100);
            expect(result.orderNumbers).toContain(200);
        });

        it('should not extract very short numbers', () => {
            const result = extractEntitiesRegex('I have 5 items', 'user@test.com');
            expect(result.orderNumbers).toHaveLength(0);
        });
    });

    describe('Tracking Numbers', () => {
        it('should extract Zásilkovna tracking number', () => {
            const result = extractEntitiesRegex('Tracking: Z1234567890', 'user@test.com');
            expect(result.trackingNumbers).toContain('Z1234567890');
        });

        it('should extract tracking with label', () => {
            const result = extractEntitiesRegex('Číslo zásilky: ABC123456789', 'user@test.com');
            expect(result.trackingNumbers).toContain('ABC123456789');
        });
    });

    describe('Email Addresses', () => {
        it('should extract email from body text', () => {
            const result = extractEntitiesRegex('Send it to info@store.cz please', 'user@test.com');
            expect(result.emails).toContain('info@store.cz');
        });

        it('should not extract invalid emails', () => {
            const result = extractEntitiesRegex('No email here', 'user@test.com');
            expect(result.emails).toHaveLength(0);
        });
    });

    describe('Phone Numbers', () => {
        it('should extract Czech phone number', () => {
            const result = extractEntitiesRegex('Volejte +420 777 888 999', 'user@test.com');
            expect(result.phones).toContain('+420777888999');
        });

        it('should extract phone with label', () => {
            const result = extractEntitiesRegex('tel: 606123456', 'user@test.com');
            expect(result.phones.length).toBeGreaterThan(0);
        });
    });

    describe('Customer Name', () => {
        it('should extract name from From header', () => {
            const result = extractEntitiesRegex('body', 'Jan Novák <jan@example.com>');
            expect(result.customerName).toBe('Jan Novák');
        });

        it('should handle quoted names', () => {
            const result = extractEntitiesRegex('body', '"Petr Svoboda" <petr@test.cz>');
            expect(result.customerName).toBe('Petr Svoboda');
        });

        it('should return null when no name in header', () => {
            const result = extractEntitiesRegex('body', 'jan@example.com');
            expect(result.customerName).toBeNull();
        });
    });

    describe('Combined Extraction', () => {
        it('should extract multiple entity types from a real-world email', () => {
            const body = `Dobrý den,
chtěl bych se zeptat na stav objednávky #4521.
Mám tracking číslo Z9876543210 ale zásilka nepřišla.
Můj telefon je +420 777 123 456.
Děkuji,
Jan Novák`;

            const result = extractEntitiesRegex(body, 'Jan Novák <jan.novak@email.cz>');

            expect(result.orderNumbers).toContain(4521);
            expect(result.trackingNumbers).toContain('Z9876543210');
            expect(result.phones).toContain('+420777123456');
            expect(result.customerName).toBe('Jan Novák');
        });

        it('should return empty result for empty text', () => {
            const result = extractEntitiesRegex('', '');
            expect(result.orderNumbers).toHaveLength(0);
            expect(result.trackingNumbers).toHaveLength(0);
            expect(result.emails).toHaveLength(0);
            expect(result.phones).toHaveLength(0);
            expect(result.customerName).toBeNull();
        });
    });
});
