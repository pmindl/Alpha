---
name: alpha-testing
description: Standard patterns for writing Vitest tests in the Alpha monorepo
---

# Alpha Testing Patterns

Standard testing conventions for the Alpha ecosystem.

## Framework

- **Test Runner**: Vitest v4+
- **React Testing**: `@testing-library/react` + `jsdom`
- **Assertions**: Vitest built-in + `@testing-library/jest-dom`

## File Conventions

| Pattern | Location |
|---------|----------|
| Unit tests | `src/__tests__/<module>.test.ts` |
| Component tests | `src/__tests__/<Component>.test.tsx` |
| Integration tests | `src/__tests__/<feature>.integration.test.ts` |

## Standard Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ModuleName", () => {
    // Group by method/feature
    describe("methodName", () => {
        it("does the expected thing", () => {
            // Arrange
            const input = "test";

            // Act
            const result = doSomething(input);

            // Assert
            expect(result).toBe("expected");
        });

        it("handles errors gracefully", () => {
            expect(() => doSomething(null)).toThrow("Expected error");
        });
    });
});
```

## Mocking Patterns

### Mock fetch (for API calls)
```typescript
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: "result" }),
});
```

### Mock modules
```typescript
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
    Client: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
    })),
}));
```

### Temp files (for filesystem tests)
```typescript
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-"));
});
afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

## React Component Testing

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/ui/button";

it("handles click", () => {
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(clicked).toBe(true);
});
```

## Vitest Config

### Node.js packages (`packages/security`, `packages/sdk`):
No special config needed — vitest defaults work.

### React packages (`packages/ui`):
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/__tests__/setup.ts"],
    },
});
```

### Setup file:
```typescript
// src/__tests__/setup.ts
import "@testing-library/jest-dom/vitest";
```

## Running Tests

```bash
# All tests
npm test

# Single package
cd packages/security && npx vitest run

# Watch mode
cd packages/security && npx vitest

# With coverage
cd packages/security && npx vitest run --coverage
```
