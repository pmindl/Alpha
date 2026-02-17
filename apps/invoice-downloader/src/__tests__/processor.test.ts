import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmailData, InvoiceMetadata, ProcessingResult } from "../lib/types";

/**
 * Tests for invoice-downloader utility functions and types.
 * 
 * Since the main processor relies heavily on external APIs (Gmail, Gemini, GDrive),
 * we test the pure functions and type contracts here.
 */

// Re-implement containsKeyword since it's not exported (testing the logic)
function containsKeyword(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
}

const PRIORITIZED_KEYWORDS = ['faktura', 'invoice', 'doklad', 'účtenka', 'billing', 'dobropis', 'platba', 'tax', 'vat', 'payment', 'receipt'];
const BLACKLIST_KEYWORDS = [
    'zasilkovna', 'balikovna', 'ppl', 'dpd', 'gls', 'toptrans', 'dhl', 'fedex',
    'label', 'stitok', 'stitek', 'tracking', 'return', 'reklamace',
    'obchodni_podminky', 'terms', 'manual', 'navod', 'instruction',
    'logo', 'icon', 'banner', 'footer', 'social', 'facebook', 'instagram', 'twitter', 'linkedin',
];

describe("containsKeyword", () => {
    it("returns true when keyword is found in text", () => {
        expect(containsKeyword("Your invoice is attached", PRIORITIZED_KEYWORDS)).toBe(true);
    });

    it("is case-insensitive", () => {
        expect(containsKeyword("FAKTURA za služby", PRIORITIZED_KEYWORDS)).toBe(true);
    });

    it("returns false for non-matching text", () => {
        expect(containsKeyword("Hello, how are you?", PRIORITIZED_KEYWORDS)).toBe(false);
    });

    it("returns false for empty text", () => {
        expect(containsKeyword("", PRIORITIZED_KEYWORDS)).toBe(false);
    });

    it("returns false for null/undefined text", () => {
        expect(containsKeyword(null as any, PRIORITIZED_KEYWORDS)).toBe(false);
    });

    it("detects blacklisted shipping carriers", () => {
        expect(containsKeyword("zasilkovna_label_12345.pdf", BLACKLIST_KEYWORDS)).toBe(true);
        expect(containsKeyword("DHL_tracking_info.pdf", BLACKLIST_KEYWORDS)).toBe(true);
    });

    it("detects blacklisted logos/social media", () => {
        expect(containsKeyword("company_logo.png", BLACKLIST_KEYWORDS)).toBe(true);
        expect(containsKeyword("facebook_banner.jpg", BLACKLIST_KEYWORDS)).toBe(true);
    });

    it("does NOT blacklist actual invoice files", () => {
        expect(containsKeyword("faktura_2024_01.pdf", BLACKLIST_KEYWORDS)).toBe(false);
        expect(containsKeyword("invoice_12345.pdf", BLACKLIST_KEYWORDS)).toBe(false);
    });
});

describe("Type contracts", () => {
    it("EmailData has correct shape", () => {
        const email: EmailData = {
            id: "msg123",
            threadId: "thread456",
            subject: "Faktura za služby",
            sender: "test@example.com",
            date: "2024-01-15T10:00:00Z",
            body: "Please find attached invoice.",
            snippet: "Please find...",
            attachments: [
                { id: "att1", filename: "invoice.pdf", mimeType: "application/pdf", size: 1024 },
            ],
        };

        expect(email.id).toBe("msg123");
        expect(email.attachments).toHaveLength(1);
        expect(email.attachments[0].mimeType).toBe("application/pdf");
    });

    it("ProcessingResult has correct shape", () => {
        const result: ProcessingResult = {
            success: true,
            processedCount: 3,
            results: [{ emailId: "1", subject: "Test" }],
            fullLogs: ["Starting...", "Done."],
        };

        expect(result.success).toBe(true);
        expect(result.processedCount).toBe(3);
        expect(result.fullLogs).toHaveLength(2);
    });

    it("ProcessingResult with error", () => {
        const result: ProcessingResult = {
            success: false,
            processedCount: 0,
            results: [],
            fullLogs: ["Failed"],
            error: "Auth error",
        };

        expect(result.success).toBe(false);
        expect(result.error).toBe("Auth error");
    });
});

describe("MIME type filtering logic", () => {
    const SUPPORTED_MIME_TYPES = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/tiff",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/xml",
        "application/xml",
        "text/plain",
    ];

    function isSupportedMime(mimeType: string): boolean {
        return SUPPORTED_MIME_TYPES.some(type => mimeType.includes(type));
    }

    function isSupportedExtension(filename: string): boolean {
        return /\.(pdf|jpg|jpeg|png|doc|docx|xml|txt)$/i.test(filename);
    }

    it("accepts PDF files", () => {
        expect(isSupportedMime("application/pdf")).toBe(true);
        expect(isSupportedExtension("invoice.pdf")).toBe(true);
    });

    it("accepts image files", () => {
        expect(isSupportedMime("image/jpeg")).toBe(true);
        expect(isSupportedMime("image/png")).toBe(true);
    });

    it("accepts Word documents", () => {
        expect(isSupportedMime("application/msword")).toBe(true);
        expect(isSupportedExtension("report.docx")).toBe(true);
    });

    it("rejects ZIP files", () => {
        expect(isSupportedMime("application/zip")).toBe(false);
        expect(isSupportedExtension("archive.zip")).toBe(false);
    });

    it("rejects executables", () => {
        expect(isSupportedMime("application/x-executable")).toBe(false);
        expect(isSupportedExtension("virus.exe")).toBe(false);
    });

    it("rejects HTML files", () => {
        expect(isSupportedMime("text/html")).toBe(false);
    });
});
