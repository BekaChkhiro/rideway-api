import { z } from 'zod';

// Create/Get Conversation (by participant)
export const createConversationSchema = z.object({
  participantId: z.string().uuid('არასწორი user ID'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

// Conversation ID param
export const conversationIdParamSchema = z.object({
  id: z.string().uuid('არასწორი conversation ID'),
});

export type ConversationIdParams = z.infer<typeof conversationIdParamSchema>;

// Send Message
export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'შეტყობინება სავალდებულოა')
    .max(5000, 'მაქსიმუმ 5000 სიმბოლო'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Pagination
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 50))),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
