import { Router } from 'express';
import { postsController } from '../controllers/posts.controller';
import { commentsController } from '../controllers/comments.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate, optionalAuth } from '../middleware/auth';
import { uploadPostImages } from '../middleware/upload';
import {
  createPostSchema,
  updatePostSchema,
  postIdParamSchema,
  userIdParamSchema,
  hashtagParamSchema,
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
} from '../validators/posts';

const router = Router();

// Get feed (authenticated)
router.get('/feed', authenticate, asyncHandler(postsController.getFeed));

// Get trending posts (optionally authenticated)
router.get('/trending', optionalAuth, asyncHandler(postsController.getTrending));

// Get posts by hashtag (optionally authenticated)
router.get(
  '/hashtag/:tag',
  optionalAuth,
  validate(hashtagParamSchema, 'params'),
  asyncHandler(postsController.getPostsByHashtag)
);

// Get user posts (optionally authenticated)
router.get(
  '/user/:userId',
  optionalAuth,
  validate(userIdParamSchema, 'params'),
  asyncHandler(postsController.getUserPosts)
);

// Create post (authenticated)
router.post(
  '/',
  authenticate,
  uploadPostImages,
  validate(createPostSchema),
  asyncHandler(postsController.createPost)
);

// Get single post (optionally authenticated)
router.get(
  '/:id',
  optionalAuth,
  validate(postIdParamSchema, 'params'),
  asyncHandler(postsController.getPost)
);

// Update post (authenticated)
router.patch(
  '/:id',
  authenticate,
  validate(postIdParamSchema, 'params'),
  validate(updatePostSchema),
  asyncHandler(postsController.updatePost)
);

// Delete post (authenticated)
router.delete(
  '/:id',
  authenticate,
  validate(postIdParamSchema, 'params'),
  asyncHandler(postsController.deletePost)
);

// Toggle like (authenticated)
router.post(
  '/:id/like',
  authenticate,
  validate(postIdParamSchema, 'params'),
  asyncHandler(postsController.toggleLike)
);

// ============================================
// COMMENTS
// ============================================

// Get post comments (optionally authenticated)
router.get(
  '/:id/comments',
  optionalAuth,
  validate(postIdParamSchema, 'params'),
  asyncHandler(commentsController.getComments)
);

// Add comment (authenticated)
router.post(
  '/:id/comments',
  authenticate,
  validate(postIdParamSchema, 'params'),
  validate(createCommentSchema),
  asyncHandler(commentsController.createComment)
);

// Get comment replies (optionally authenticated)
router.get(
  '/comments/:commentId/replies',
  optionalAuth,
  validate(commentIdParamSchema, 'params'),
  asyncHandler(commentsController.getReplies)
);

// Update comment (authenticated)
router.patch(
  '/comments/:commentId',
  authenticate,
  validate(commentIdParamSchema, 'params'),
  validate(updateCommentSchema),
  asyncHandler(commentsController.updateComment)
);

// Delete comment (authenticated)
router.delete(
  '/comments/:commentId',
  authenticate,
  validate(commentIdParamSchema, 'params'),
  asyncHandler(commentsController.deleteComment)
);

// Toggle comment like (authenticated)
router.post(
  '/comments/:commentId/like',
  authenticate,
  validate(commentIdParamSchema, 'params'),
  asyncHandler(commentsController.toggleLike)
);

export default router;
