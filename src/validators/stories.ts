import { z } from 'zod';

// Create story - validation handled by multer, just need mediaType
export const createStorySchema = z.object({
  mediaType: z.enum(['IMAGE', 'VIDEO']).optional().default('IMAGE'),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;

// Pagination for story views
export const storyViewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

export type StoryViewsQuery = z.infer<typeof storyViewsQuerySchema>;

// Story ID param
export const storyIdParamSchema = z.object({
  id: z.string().uuid('Invalid story ID'),
});

export type StoryIdParam = z.infer<typeof storyIdParamSchema>;

// User ID param for getting user's stories
export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
