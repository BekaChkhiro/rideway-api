import { z } from 'zod';

// Listing Condition enum
const listingCondition = z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'PARTS']);

// Listing Status enum
const listingStatus = z.enum(['ACTIVE', 'SOLD', 'RESERVED', 'DELETED']);

// Create Listing
export const createListingSchema = z.object({
  title: z
    .string()
    .min(5, 'სათაური მინიმუმ 5 სიმბოლო')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლო'),
  description: z
    .string()
    .min(20, 'აღწერა მინიმუმ 20 სიმბოლო')
    .max(5000, 'აღწერა მაქსიმუმ 5000 სიმბოლო'),
  price: z
    .string()
    .transform((val) => parseFloat(val))
    .refine((val) => val > 0, 'ფასი უნდა იყოს დადებითი'),
  currency: z.string().default('GEL'),
  categoryId: z.string().uuid('არასწორი კატეგორიის ID'),
  condition: listingCondition,
  location: z
    .string()
    .min(2, 'ლოკაცია სავალდებულოა')
    .max(100, 'ლოკაცია მაქსიმუმ 100 სიმბოლო'),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => !val || (val >= 1900 && val <= new Date().getFullYear() + 1), 'არასწორი წელი'),
  mileage: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => !val || val >= 0, 'გარბენი არ შეიძლება იყოს უარყოფითი'),
  engineSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => !val || val > 0, 'ძრავის მოცულობა უნდა იყოს დადებითი'),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

// Update Listing
export const updateListingSchema = z.object({
  title: z
    .string()
    .min(5, 'სათაური მინიმუმ 5 სიმბოლო')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლო')
    .optional(),
  description: z
    .string()
    .min(20, 'აღწერა მინიმუმ 20 სიმბოლო')
    .max(5000, 'აღწერა მაქსიმუმ 5000 სიმბოლო')
    .optional(),
  price: z
    .number()
    .positive('ფასი უნდა იყოს დადებითი')
    .optional(),
  currency: z.string().optional(),
  categoryId: z.string().uuid('არასწორი კატეგორიის ID').optional(),
  condition: listingCondition.optional(),
  location: z
    .string()
    .min(2, 'ლოკაცია სავალდებულოა')
    .max(100, 'ლოკაცია მაქსიმუმ 100 სიმბოლო')
    .optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  mileage: z.number().int().min(0).optional(),
  engineSize: z.number().int().positive().optional(),
  status: listingStatus.optional(),
});

export type UpdateListingInput = z.infer<typeof updateListingSchema>;

// Listing ID param
export const listingIdParamSchema = z.object({
  id: z.string().uuid('არასწორი listing ID'),
});

export type ListingIdParams = z.infer<typeof listingIdParamSchema>;

// Get Listings Query
export const getListingsQuerySchema = z.object({
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
  minPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  maxPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined)),
  condition: listingCondition.optional(),
  location: z.string().optional(),
  brand: z.string().optional(),
  status: listingStatus.optional().default('ACTIVE'),
  sort: z.enum(['latest', 'oldest', 'price_asc', 'price_desc', 'popular']).optional().default('latest'),
});

export type GetListingsQuery = z.infer<typeof getListingsQuerySchema>;

// Search Listings Query
export const searchListingsQuerySchema = z.object({
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

export type SearchListingsQuery = z.infer<typeof searchListingsQuerySchema>;

// Popular Listings Query
export const popularListingsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.min(20, Math.max(1, parseInt(val, 10) || 10))),
});

export type PopularListingsQuery = z.infer<typeof popularListingsQuerySchema>;

// User Listings Query
export const userListingsQuerySchema = z.object({
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
  status: listingStatus.optional(),
});

export type UserListingsQuery = z.infer<typeof userListingsQuerySchema>;

// User ID param
export const userIdParamSchema = z.object({
  userId: z.string().uuid('არასწორი user ID'),
});

export type UserIdParams = z.infer<typeof userIdParamSchema>;

// Pagination for favorites
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

// Category
export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100),
  parentId: z.string().uuid().optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional().default(0),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
