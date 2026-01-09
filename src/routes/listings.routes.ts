import { Router } from 'express';
import { listingsController } from '../controllers/listings.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate, optionalAuth } from '../middleware/auth';
import { uploadListingImages } from '../middleware/upload';
import {
  createListingSchema,
  updateListingSchema,
  listingIdParamSchema,
  userIdParamSchema,
} from '../validators/listings';

const router = Router();

// ==================== CATEGORIES ====================

// Get all categories (public)
router.get('/categories', asyncHandler(listingsController.getCategories));

// ==================== LISTINGS ====================

// Get my favorites (authenticated) - must be before /:id
router.get('/favorites', authenticate, asyncHandler(listingsController.getFavorites));

// Search listings (optionally authenticated) - must be before /:id
router.get('/search', optionalAuth, asyncHandler(listingsController.searchListings));

// Get popular listings (optionally authenticated) - must be before /:id
router.get('/popular', optionalAuth, asyncHandler(listingsController.getPopularListings));

// Get user listings (optionally authenticated) - must be before /:id
router.get(
  '/user/:userId',
  optionalAuth,
  validate(userIdParamSchema, 'params'),
  asyncHandler(listingsController.getUserListings)
);

// Get listings with filters (optionally authenticated)
router.get('/', optionalAuth, asyncHandler(listingsController.getListings));

// Create listing (authenticated)
router.post(
  '/',
  authenticate,
  uploadListingImages,
  validate(createListingSchema),
  asyncHandler(listingsController.createListing)
);

// Get single listing (optionally authenticated)
router.get(
  '/:id',
  optionalAuth,
  validate(listingIdParamSchema, 'params'),
  asyncHandler(listingsController.getListing)
);

// Update listing (authenticated)
router.patch(
  '/:id',
  authenticate,
  validate(listingIdParamSchema, 'params'),
  validate(updateListingSchema),
  asyncHandler(listingsController.updateListing)
);

// Delete listing (authenticated)
router.delete(
  '/:id',
  authenticate,
  validate(listingIdParamSchema, 'params'),
  asyncHandler(listingsController.deleteListing)
);

// Mark as sold (authenticated)
router.post(
  '/:id/sold',
  authenticate,
  validate(listingIdParamSchema, 'params'),
  asyncHandler(listingsController.markAsSold)
);

// ==================== FAVORITES ====================

// Add to favorites (authenticated)
router.post(
  '/:id/favorite',
  authenticate,
  validate(listingIdParamSchema, 'params'),
  asyncHandler(listingsController.toggleFavorite)
);

// Remove from favorites (authenticated)
router.delete(
  '/:id/favorite',
  authenticate,
  validate(listingIdParamSchema, 'params'),
  asyncHandler(listingsController.removeFavorite)
);

export default router;
