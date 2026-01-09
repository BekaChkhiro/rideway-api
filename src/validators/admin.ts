import { z } from 'zod';

// Pagination
export const adminPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 20))),
});

export type AdminPaginationInput = z.infer<typeof adminPaginationSchema>;

// Get Users (admin)
export const adminGetUsersSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  q: z.string().optional(),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
  isBanned: z.enum(['true', 'false']).optional(),
  isVerified: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'username', 'fullName']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AdminGetUsersInput = z.infer<typeof adminGetUsersSchema>;

// User ID param
export const adminUserIdSchema = z.object({
  id: z.string().uuid('არასწორი user ID'),
});

export type AdminUserIdParams = z.infer<typeof adminUserIdSchema>;

// Change user role
export const changeUserRoleSchema = z.object({
  role: z.enum(['USER', 'MODERATOR', 'ADMIN'], {
    message: 'როლი სავალდებულოა',
  }),
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

// Ban user
export const banUserSchema = z.object({
  reason: z.string().min(1, 'მიზეზი სავალდებულოა').max(500),
  duration: z.number().int().positive().optional(), // duration in hours, undefined = permanent
});

export type BanUserInput = z.infer<typeof banUserSchema>;

// Content ID param (generic)
export const contentIdSchema = z.object({
  id: z.string().uuid('არასწორი ID'),
});

export type ContentIdParams = z.infer<typeof contentIdSchema>;

// Get content (posts, comments, listings, threads)
export const adminGetContentSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  reported: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'reportCount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AdminGetContentInput = z.infer<typeof adminGetContentSchema>;

// Delete content reason
export const deleteContentSchema = z.object({
  reason: z.string().min(1, 'მიზეზი სავალდებულოა').max(500),
});

export type DeleteContentInput = z.infer<typeof deleteContentSchema>;

// Dashboard date range
export const dashboardStatsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ფორმატი: YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ფორმატი: YYYY-MM-DD').optional(),
});

export type DashboardStatsInput = z.infer<typeof dashboardStatsSchema>;
