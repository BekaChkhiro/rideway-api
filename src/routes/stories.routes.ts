import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadStoryMedia } from '../middleware/upload';
import * as storiesController from '../controllers/stories.controller';
import {
  storyIdParamSchema,
  userIdParamSchema,
  storyViewsQuerySchema,
} from '../validators/stories';

const router = Router();

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================

// POST /stories - Create a new story
router.post(
  '/',
  authenticate,
  uploadStoryMedia,
  asyncHandler(storiesController.createStory)
);

// GET /stories - Get feed stories (grouped by user)
router.get('/', authenticate, asyncHandler(storiesController.getFeedStories));

// GET /stories/me - Get my active stories
router.get('/me', authenticate, asyncHandler(storiesController.getMyStories));

// POST /stories/:id/view - Mark story as viewed
router.post(
  '/:id/view',
  authenticate,
  validate(storyIdParamSchema, 'params'),
  asyncHandler(storiesController.viewStory)
);

// GET /stories/:id/viewers - Get story viewers (owner only)
router.get(
  '/:id/viewers',
  authenticate,
  validate(storyIdParamSchema, 'params'),
  validate(storyViewsQuerySchema, 'query'),
  asyncHandler(storiesController.getStoryViewers)
);

// DELETE /stories/:id - Delete a story
router.delete(
  '/:id',
  authenticate,
  validate(storyIdParamSchema, 'params'),
  asyncHandler(storiesController.deleteStory)
);

// ============================================
// PUBLIC/OPTIONAL AUTH ROUTES
// ============================================

// GET /stories/user/:userId - Get user's active stories
router.get(
  '/user/:userId',
  optionalAuth,
  validate(userIdParamSchema, 'params'),
  asyncHandler(storiesController.getUserStories)
);

// GET /stories/:id - Get a single story
router.get(
  '/:id',
  optionalAuth,
  validate(storyIdParamSchema, 'params'),
  asyncHandler(storiesController.getStory)
);

export default router;
