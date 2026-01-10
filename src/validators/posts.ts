import { z } from 'zod';

// Create Post
export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'კონტენტი სავალდებულოა')
    .max(2000, 'მაქსიმუმ 2000 სიმბოლო'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// Update Post
export const updatePostSchema = z.object({
  content: z
    .string()
    .min(1, 'კონტენტი სავალდებულოა')
    .max(2000, 'მაქსიმუმ 2000 სიმბოლო'),
  deleteImageIds: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      try {
        return JSON.parse(val) as string[];
      } catch {
        return val.split(',').filter(Boolean);
      }
    }),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

// Post ID param
export const postIdParamSchema = z.object({
  id: z.string().uuid('არასწორი post ID'),
});

export type PostIdParams = z.infer<typeof postIdParamSchema>;

// User ID param (for user posts)
export const userIdParamSchema = z.object({
  userId: z.string().uuid('არასწორი user ID'),
});

export type UserIdParams = z.infer<typeof userIdParamSchema>;

// Hashtag param
export const hashtagParamSchema = z.object({
  tag: z.string().min(1, 'hashtag სავალდებულოა').max(100),
});

export type HashtagParams = z.infer<typeof hashtagParamSchema>;

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

// Create Comment
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'კომენტარი სავალდებულოა')
    .max(1000, 'მაქსიმუმ 1000 სიმბოლო'),
  parentId: z.string().uuid('არასწორი parent ID').optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// Update Comment
export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'კომენტარი სავალდებულოა')
    .max(1000, 'მაქსიმუმ 1000 სიმბოლო'),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// Comment ID param
export const commentIdParamSchema = z.object({
  commentId: z.string().uuid('არასწორი comment ID'),
});

export type CommentIdParams = z.infer<typeof commentIdParamSchema>;
