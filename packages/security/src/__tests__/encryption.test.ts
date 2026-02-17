import { describe, it, expect } from "vitest";
import { Encryption } from "../encryption";

describe("Encryption", () => {
    const validKey = "a".repeat(64); // 64-char hex = 32 bytes

    describe("constructor", () => {
        it("accepts a valid 64-char hex key", () => {
            expect(() => new Encryption(validKey)).not.toThrow();
        });

        it("rejects an empty key", () => {
            expect(() => new Encryption("")).toThrow("Master key must be a 64-character hex string");
        });

        it("rejects a key that is too short", () => {
            expect(() => new Encryption("abcd1234")).toThrow("Master key must be a 64-character hex string");
        });

        it("rejects a key that is too long", () => {
            expect(() => new Encryption("a".repeat(128))).toThrow("Master key must be a 64-character hex string");
        });
    });

    describe("encrypt/decrypt roundtrip", () => {
        it("encrypts and decrypts a simple string", () => {
            const enc = new Encryption(validKey);
            const plaintext = "Hello, Alpha!";

            const encrypted = enc.encrypt(plaintext);
            const decrypted = enc.decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it("encrypts and decrypts JSON data", () => {
            const enc = new Encryption(validKey);
            const data = JSON.stringify({ apiKey: "sk-123", secret: "very-secret" });

            const encrypted = enc.encrypt(data);
            const decrypted = enc.decrypt(encrypted);

            expect(JSON.parse(decrypted)).toEqual({ apiKey: "sk-123", secret: "very-secret" });
        });

        it("encrypts and decrypts an empty string", () => {
            const enc = new Encryption(validKey);

            const encrypted = enc.encrypt("");
            const decrypted = enc.decrypt(encrypted);

            expect(decrypted).toBe("");
        });

        it("produces different ciphertexts for the same plaintext (random IV)", () => {
            const enc = new Encryption(validKey);
            const plaintext = "same input";

            const e1 = enc.encrypt(plaintext);
            const e2 = enc.encrypt(plaintext);

            expect(e1.content).not.toBe(e2.content);
            expect(e1.iv).not.toBe(e2.iv);
        });
    });

    describe("encrypted output structure", () => {
        it("returns iv, content, and authTag", () => {
            const enc = new Encryption(validKey);
            const encrypted = enc.encrypt("test");

            expect(encrypted).toHaveProperty("iv");
            expect(encrypted).toHaveProperty("content");
            expect(encrypted).toHaveProperty("authTag");
            expect(typeof encrypted.iv).toBe("string");
            expect(typeof encrypted.content).toBe("string");
            expect(typeof encrypted.authTag).toBe("string");
        });
    });

    describe("tamper detection", () => {
        it("throws on tampered ciphertext", () => {
            const enc = new Encryption(validKey);
            const encrypted = enc.encrypt("sensitive data");

            // Tamper with content
            encrypted.content = "f".repeat(encrypted.content.length);

            expect(() => enc.decrypt(encrypted)).toThrow();
        });

        it("throws on tampered auth tag", () => {
            const enc = new Encryption(validKey);
            const encrypted = enc.encrypt("sensitive data");

            // Tamper with auth tag
            encrypted.authTag = "0".repeat(encrypted.authTag.length);

            expect(() => enc.decrypt(encrypted)).toThrow();
        });

        it("throws when decrypting with wrong key", () => {
            const enc1 = new Encryption(validKey);
            const enc2 = new Encryption("b".repeat(64));

            const encrypted = enc1.encrypt("secret");

            expect(() => enc2.decrypt(encrypted)).toThrow();
        });
    });

    describe("generateMasterKey", () => {
        it("returns a 64-character hex string", () => {
            const key = Encryption.generateMasterKey();

            expect(key).toHaveLength(64);
            expect(key).toMatch(/^[0-9a-f]{64}$/);
        });

        it("generates unique keys", () => {
            const key1 = Encryption.generateMasterKey();
            const key2 = Encryption.generateMasterKey();

            expect(key1).not.toBe(key2);
        });
    });
});
