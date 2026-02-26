import { z } from 'zod';

// Define schemas for tool arguments
export const GetRecentOrdersSchema = z.object({
  email: z.string().email("Invalid email address format"),
});

export const DraftReplySchema = z.object({
  threadId: z.string().min(1, "Thread ID cannot be empty"),
  message: z.string().min(1, "Message content cannot be empty"),
});

// Infer types for convenience (optional, but good practice)
export type GetRecentOrdersInput = z.infer<typeof GetRecentOrdersSchema>;
export type DraftReplyInput = z.infer<typeof DraftReplySchema>;
