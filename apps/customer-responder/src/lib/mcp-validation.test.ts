import { describe, it, expect } from 'vitest';
import { GetRecentOrdersSchema, DraftReplySchema } from './mcp-validation';

describe('MCP Tool Validation', () => {
  describe('GetRecentOrdersSchema', () => {
    it('should validate correct email', () => {
      const input = { email: 'customer@example.com' };
      const result = GetRecentOrdersSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('customer@example.com');
      }
    });

    it('should reject invalid email format', () => {
      const input = { email: 'not-an-email' };
      const result = GetRecentOrdersSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid email');
      }
    });

    it('should reject non-string input', () => {
      const input = { email: 12345 };
      const result = GetRecentOrdersSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('DraftReplySchema', () => {
    it('should validate correct input', () => {
      const input = { threadId: 'thread-123', message: 'Hello there' };
      const result = DraftReplySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty threadId', () => {
      const input = { threadId: '', message: 'Hello' };
      const result = DraftReplySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty message', () => {
      const input = { threadId: 'thread-123', message: '' };
      const result = DraftReplySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
