import { Router } from 'express';
import { forumController } from '../controllers/forum.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  createThreadSchema,
  updateThreadSchema,
  threadIdParamSchema,
  replyIdParamSchema,
  createReplySchema,
  updateReplySchema,
} from '../validators/forum';

const router = Router();

// ==================== CATEGORIES ====================

// Get all categories (public)
router.get('/categories', asyncHandler(forumController.getCategories));

// ==================== THREADS ====================

// Get threads with filters (optionally authenticated)
router.get('/threads', optionalAuth, asyncHandler(forumController.getThreads));

// Create thread (authenticated)
router.post(
  '/threads',
  authenticate,
  validate(createThreadSchema),
  asyncHandler(forumController.createThread)
);

// Get single thread (optionally authenticated)
router.get(
  '/threads/:id',
  optionalAuth,
  validate(threadIdParamSchema, 'params'),
  asyncHandler(forumController.getThread)
);

// Update thread (authenticated)
router.patch(
  '/threads/:id',
  authenticate,
  validate(threadIdParamSchema, 'params'),
  validate(updateThreadSchema),
  asyncHandler(forumController.updateThread)
);

// Delete thread (authenticated)
router.delete(
  '/threads/:id',
  authenticate,
  validate(threadIdParamSchema, 'params'),
  asyncHandler(forumController.deleteThread)
);

// Like/Unlike thread (authenticated)
router.post(
  '/threads/:id/like',
  authenticate,
  validate(threadIdParamSchema, 'params'),
  asyncHandler(forumController.toggleThreadLike)
);

// ==================== REPLIES ====================

// Get thread replies (optionally authenticated)
router.get(
  '/threads/:id/replies',
  optionalAuth,
  validate(threadIdParamSchema, 'params'),
  asyncHandler(forumController.getReplies)
);

// Add reply to thread (authenticated)
router.post(
  '/threads/:id/replies',
  authenticate,
  validate(threadIdParamSchema, 'params'),
  validate(createReplySchema),
  asyncHandler(forumController.createReply)
);

// Update reply (authenticated)
router.patch(
  '/replies/:replyId',
  authenticate,
  validate(replyIdParamSchema, 'params'),
  validate(updateReplySchema),
  asyncHandler(forumController.updateReply)
);

// Delete reply (authenticated)
router.delete(
  '/replies/:replyId',
  authenticate,
  validate(replyIdParamSchema, 'params'),
  asyncHandler(forumController.deleteReply)
);

// Like/Unlike reply (authenticated)
router.post(
  '/replies/:replyId/like',
  authenticate,
  validate(replyIdParamSchema, 'params'),
  asyncHandler(forumController.toggleReplyLike)
);

export default router;
