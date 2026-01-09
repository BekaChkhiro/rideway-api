import { Router } from 'express';
import { servicesController } from '../controllers/services.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate } from '../middleware/auth';
import { uploadServiceImages } from '../middleware/upload';
import {
  createServiceSchema,
  updateServiceSchema,
  serviceIdParamSchema,
  userIdParamSchema,
  createReviewSchema,
} from '../validators/services';

const router = Router();

// ==================== CATEGORIES ====================

// Get all categories (public)
router.get('/categories', asyncHandler(servicesController.getCategories));

// ==================== SERVICES ====================

// Search services (public) - must be before /:id
router.get('/search', asyncHandler(servicesController.searchServices));

// Get user services (public) - must be before /:id
router.get(
  '/user/:userId',
  validate(userIdParamSchema, 'params'),
  asyncHandler(servicesController.getUserServices)
);

// Get services with filters (public)
router.get('/', asyncHandler(servicesController.getServices));

// Create service (authenticated)
router.post(
  '/',
  authenticate,
  uploadServiceImages,
  validate(createServiceSchema),
  asyncHandler(servicesController.createService)
);

// Get single service (public)
router.get(
  '/:id',
  validate(serviceIdParamSchema, 'params'),
  asyncHandler(servicesController.getService)
);

// Update service (authenticated)
router.patch(
  '/:id',
  authenticate,
  validate(serviceIdParamSchema, 'params'),
  validate(updateServiceSchema),
  asyncHandler(servicesController.updateService)
);

// Delete service (authenticated)
router.delete(
  '/:id',
  authenticate,
  validate(serviceIdParamSchema, 'params'),
  asyncHandler(servicesController.deleteService)
);

// ==================== REVIEWS ====================

// Get service reviews (public)
router.get(
  '/:id/reviews',
  validate(serviceIdParamSchema, 'params'),
  asyncHandler(servicesController.getReviews)
);

// Add review (authenticated)
router.post(
  '/:id/reviews',
  authenticate,
  validate(serviceIdParamSchema, 'params'),
  validate(createReviewSchema),
  asyncHandler(servicesController.createReview)
);

// Delete own review (authenticated)
router.delete(
  '/:id/reviews',
  authenticate,
  validate(serviceIdParamSchema, 'params'),
  asyncHandler(servicesController.deleteReview)
);

export default router;
