import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
    "packages/security",
    "packages/sdk",
    "packages/ui",
    "apps/master",
    "apps/invoice-downloader",
    "apps/invoice-processor",
    "apps/customer-responder",
]);
