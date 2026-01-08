import { z } from 'zod';

// Common validators
const usernameSchema = z
  .string()
  .min(3, 'მინიმუმ 3 სიმბოლო')
  .max(30, 'მაქსიმუმ 30 სიმბოლო')
  .regex(/^[a-zA-Z0-9_]+$/, 'მხოლოდ ლათინური ასოები, ციფრები და _');

// Update Profile
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  fullName: z
    .string()
    .min(2, 'მინიმუმ 2 სიმბოლო')
    .max(100, 'მაქსიმუმ 100 სიმბოლო')
    .optional(),
  bio: z.string().max(500, 'მაქსიმუმ 500 სიმბოლო').optional().nullable(),
  location: z.string().max(100, 'მაქსიმუმ 100 სიმბოლო').optional().nullable(),
  website: z.string().url('არასწორი URL').max(200).optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'ფორმატი: YYYY-MM-DD')
    .optional()
    .nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Get User Profile (by username or id)
export const getUserProfileSchema = z.object({
  username: z.string().min(1, 'username სავალდებულოა'),
});

export type GetUserProfileParams = z.infer<typeof getUserProfileSchema>;

// User ID param
export const userIdParamSchema = z.object({
  id: z.string().uuid('არასწორი user ID'),
});

export type UserIdParams = z.infer<typeof userIdParamSchema>;

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

// Search Users
export const searchUsersSchema = z.object({
  q: z.string().min(1, 'საძიებო ტექსტი სავალდებულოა').max(100),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
