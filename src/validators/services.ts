import { z } from 'zod';

// Create Service
export const createServiceSchema = z.object({
  name: z
    .string()
    .min(3, 'სახელი მინიმუმ 3 სიმბოლო')
    .max(200, 'სახელი მაქსიმუმ 200 სიმბოლო'),
  description: z
    .string()
    .min(20, 'აღწერა მინიმუმ 20 სიმბოლო')
    .max(5000, 'აღწერა მაქსიმუმ 5000 სიმბოლო'),
  categoryId: z.string().uuid('არასწორი კატეგორიის ID'),
  location: z
    .string()
    .min(2, 'ლოკაცია სავალდებულოა')
    .max(100, 'ლოკაცია მაქსიმუმ 100 სიმბოლო'),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

// Update Service
export const updateServiceSchema = z.object({
  name: z
    .string()
    .min(3, 'სახელი მინიმუმ 3 სიმბოლო')
    .max(200, 'სახელი მაქსიმუმ 200 სიმბოლო')
    .optional(),
  description: z
    .string()
    .min(20, 'აღწერა მინიმუმ 20 სიმბოლო')
    .max(5000, 'აღწერა მაქსიმუმ 5000 სიმბოლო')
    .optional(),
  categoryId: z.string().uuid('არასწორი კატეგორიის ID').optional(),
  location: z
    .string()
    .min(2, 'ლოკაცია სავალდებულოა')
    .max(100, 'ლოკაცია მაქსიმუმ 100 სიმბოლო')
    .optional(),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

// Service ID param
export const serviceIdParamSchema = z.object({
  id: z.string().uuid('არასწორი service ID'),
});

export type ServiceIdParams = z.infer<typeof serviceIdParamSchema>;

// Get Services Query
export const getServicesQuerySchema = z.object({
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
  location: z.string().optional(),
  sort: z.enum(['latest', 'oldest', 'rating', 'most_reviews']).optional().default('latest'),
});

export type GetServicesQuery = z.infer<typeof getServicesQuerySchema>;

// Search Services Query
export const searchServicesQuerySchema = z.object({
  q: z.string().min(1, 'საძიებო სიტყვა სავალდებულოა'),
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

export type SearchServicesQuery = z.infer<typeof searchServicesQuerySchema>;

// Create Review
export const createReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'რეიტინგი მინიმუმ 1')
    .max(5, 'რეიტინგი მაქსიმუმ 5'),
  comment: z
    .string()
    .max(2000, 'კომენტარი მაქსიმუმ 2000 სიმბოლო')
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// Get Reviews Query
export const getReviewsQuerySchema = z.object({
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

export type GetReviewsQuery = z.infer<typeof getReviewsQuerySchema>;

// User ID param
export const userIdParamSchema = z.object({
  userId: z.string().uuid('არასწორი user ID'),
});

export type UserIdParams = z.infer<typeof userIdParamSchema>;
