import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { VaultManager } from "../vault";
import { Encryption } from "../encryption";

describe("VaultManager", () => {
    const masterKey = Encryption.generateMasterKey();
    let tmpDir: string;
    let vaultPath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-vault-test-"));
        vaultPath = path.join(tmpDir, "vault.encrypted.json");
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("initialization", () => {
        it("creates an empty vault when no file exists", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            const creds = vault.listCredentials();

            expect(creds).toEqual([]);
        });

        it("creates the vault file on first save", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "TEST_KEY",
                value: "test-value",
                description: "Test credential",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            expect(fs.existsSync(vaultPath)).toBe(true);
        });
    });

    describe("CRUD operations", () => {
        it("adds and retrieves a credential", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "API_KEY",
                value: "sk-abc123",
                description: "API Key",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: "openai", service: "api" },
            });

            const cred = vault.getCredential("API_KEY");

            expect(cred).toBeDefined();
            expect(cred!.id).toBe("API_KEY");
            expect(cred!.value).toBe("sk-abc123");
            expect(cred!.metadata).toEqual({ provider: "openai", service: "api" });
        });

        it("updates an existing credential (same id)", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "API_KEY",
                value: "old-value",
                description: "Old",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            vault.addCredential({
                id: "API_KEY",
                value: "new-value",
                description: "Updated",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const cred = vault.getCredential("API_KEY");
            expect(cred!.value).toBe("new-value");
            expect(cred!.description).toBe("Updated");
        });

        it("removes a credential", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "TO_DELETE",
                value: "delete-me",
                description: "Temp",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const removed = vault.removeCredential("TO_DELETE");

            expect(removed).toBe(true);
            expect(vault.getCredential("TO_DELETE")).toBeUndefined();
        });

        it("returns false when removing non-existent credential", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            const removed = vault.removeCredential("DOES_NOT_EXIST");

            expect(removed).toBe(false);
        });

        it("returns undefined for non-existent credential", () => {
            const vault = new VaultManager(masterKey, vaultPath);

            expect(vault.getCredential("NOPE")).toBeUndefined();
        });
    });

    describe("listCredentials", () => {
        it("returns credentials without values", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "SECRET",
                value: "super-secret",
                description: "A secret",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const list = vault.listCredentials();

            expect(list).toHaveLength(1);
            expect(list[0].id).toBe("SECRET");
            expect(list[0].description).toBe("A secret");
            expect((list[0] as any).value).toBeUndefined();
        });
    });

    describe("getEnvForApp", () => {
        it("returns global credentials for any app", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "GLOBAL_KEY",
                value: "global-value",
                description: "Global",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const env = vault.getEnvForApp("invoice-downloader");

            expect(env.GLOBAL_KEY).toBe("global-value");
        });

        it("returns app-scoped credentials for the matching app", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "APP_SPECIFIC",
                value: "app-value",
                description: "App specific",
                scopes: ["app:invoice-downloader"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const envMatch = vault.getEnvForApp("invoice-downloader");
            const envNoMatch = vault.getEnvForApp("invoice-processor");

            expect(envMatch.APP_SPECIFIC).toBe("app-value");
            expect(envNoMatch.APP_SPECIFIC).toBeUndefined();
        });

        it("combines global and app-scoped credentials", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "GLOBAL",
                value: "g",
                description: "",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });
            vault.addCredential({
                id: "APP_ONLY",
                value: "a",
                description: "",
                scopes: ["app:myapp"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const env = vault.getEnvForApp("myapp");

            expect(env.GLOBAL).toBe("g");
            expect(env.APP_ONLY).toBe("a");
        });
    });

    describe("persistence", () => {
        it("persists data between VaultManager instances", () => {
            // Write
            const vault1 = new VaultManager(masterKey, vaultPath);
            vault1.addCredential({
                id: "PERSIST_TEST",
                value: "persisted",
                description: "Persistence test",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            // Read (new instance)
            const vault2 = new VaultManager(masterKey, vaultPath);
            const cred = vault2.getCredential("PERSIST_TEST");

            expect(cred).toBeDefined();
            expect(cred!.value).toBe("persisted");
        });

        it("throws when loading with wrong master key", () => {
            const vault = new VaultManager(masterKey, vaultPath);
            vault.addCredential({
                id: "KEY",
                value: "val",
                description: "",
                scopes: ["global"],
                updatedAt: new Date().toISOString(),
                metadata: { provider: 'test', service: 'test' },
            });

            const wrongKey = Encryption.generateMasterKey();

            expect(() => new VaultManager(wrongKey, vaultPath)).toThrow("Failed to load or decrypt vault");
        });
    });
});
