import { z } from 'zod';

// Create Thread
export const createThreadSchema = z.object({
  title: z
    .string()
    .min(5, 'სათაური მინიმუმ 5 სიმბოლო')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლო'),
  content: z
    .string()
    .min(10, 'შინაარსი მინიმუმ 10 სიმბოლო')
    .max(10000, 'შინაარსი მაქსიმუმ 10000 სიმბოლო'),
  categoryId: z.string().uuid('არასწორი კატეგორიის ID'),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;

// Update Thread
export const updateThreadSchema = z.object({
  title: z
    .string()
    .min(5, 'სათაური მინიმუმ 5 სიმბოლო')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლო')
    .optional(),
  content: z
    .string()
    .min(10, 'შინაარსი მინიმუმ 10 სიმბოლო')
    .max(10000, 'შინაარსი მაქსიმუმ 10000 სიმბოლო')
    .optional(),
});

export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;

// Thread ID param
export const threadIdParamSchema = z.object({
  id: z.string().uuid('არასწორი thread ID'),
});

export type ThreadIdParams = z.infer<typeof threadIdParamSchema>;

// Reply ID param
export const replyIdParamSchema = z.object({
  replyId: z.string().uuid('არასწორი reply ID'),
});

export type ReplyIdParams = z.infer<typeof replyIdParamSchema>;

// Get Threads Query
export const getThreadsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 20))),
  categoryId: z.string().uuid().optional(),
  sort: z.enum(['latest', 'oldest', 'popular', 'most_replies']).optional().default('latest'),
});

export type GetThreadsQuery = z.infer<typeof getThreadsQuerySchema>;

// Create Reply
export const createReplySchema = z.object({
  content: z
    .string()
    .min(2, 'პასუხი მინიმუმ 2 სიმბოლო')
    .max(5000, 'პასუხი მაქსიმუმ 5000 სიმბოლო'),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;

// Update Reply
export const updateReplySchema = z.object({
  content: z
    .string()
    .min(2, 'პასუხი მინიმუმ 2 სიმბოლო')
    .max(5000, 'პასუხი მაქსიმუმ 5000 სიმბოლო'),
});

export type UpdateReplyInput = z.infer<typeof updateReplySchema>;

// Get Replies Query
export const getRepliesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 20))),
});

export type GetRepliesQuery = z.infer<typeof getRepliesQuerySchema>;

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
    .default('20')
    .transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 20))),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
