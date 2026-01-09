import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate, requireRole } from '../middleware/auth';
import {
  adminGetUsersSchema,
  adminUserIdSchema,
  changeUserRoleSchema,
  banUserSchema,
  contentIdSchema,
  adminGetContentSchema,
  deleteContentSchema,
} from '../validators/admin';

const router = Router();

// All routes require authentication + ADMIN or MODERATOR role
router.use(authenticate);
router.use(requireRole('ADMIN', 'MODERATOR'));

// ==================== DASHBOARD ====================

// Get dashboard stats
router.get(
  '/dashboard',
  asyncHandler(adminController.getDashboardStats)
);

// ==================== USERS ====================

// Get users list
router.get(
  '/users',
  validate(adminGetUsersSchema, 'query'),
  asyncHandler(adminController.getUsers)
);

// Get user by ID
router.get(
  '/users/:id',
  validate(adminUserIdSchema, 'params'),
  asyncHandler(adminController.getUserById)
);

// Change user role (ADMIN only)
router.patch(
  '/users/:id/role',
  requireRole('ADMIN'),
  validate(adminUserIdSchema, 'params'),
  validate(changeUserRoleSchema),
  asyncHandler(adminController.changeUserRole)
);

// Ban user
router.post(
  '/users/:id/ban',
  validate(adminUserIdSchema, 'params'),
  validate(banUserSchema),
  asyncHandler(adminController.banUser)
);

// Unban user
router.post(
  '/users/:id/unban',
  validate(adminUserIdSchema, 'params'),
  asyncHandler(adminController.unbanUser)
);

// Delete user (soft delete)
router.delete(
  '/users/:id',
  requireRole('ADMIN'),
  validate(adminUserIdSchema, 'params'),
  asyncHandler(adminController.deleteUser)
);

// ==================== POSTS ====================

// Get posts
router.get(
  '/posts',
  validate(adminGetContentSchema, 'query'),
  asyncHandler(adminController.getPosts)
);

// Delete post
router.delete(
  '/posts/:id',
  validate(contentIdSchema, 'params'),
  validate(deleteContentSchema),
  asyncHandler(adminController.deletePost)
);

// ==================== COMMENTS ====================

// Get comments
router.get(
  '/comments',
  validate(adminGetContentSchema, 'query'),
  asyncHandler(adminController.getComments)
);

// Delete comment
router.delete(
  '/comments/:id',
  validate(contentIdSchema, 'params'),
  validate(deleteContentSchema),
  asyncHandler(adminController.deleteComment)
);

// ==================== LISTINGS ====================

// Get listings
router.get(
  '/listings',
  validate(adminGetContentSchema, 'query'),
  asyncHandler(adminController.getListings)
);

// Delete listing
router.delete(
  '/listings/:id',
  validate(contentIdSchema, 'params'),
  validate(deleteContentSchema),
  asyncHandler(adminController.deleteListing)
);

// ==================== FORUM ====================

// Get forum threads
router.get(
  '/forum/threads',
  validate(adminGetContentSchema, 'query'),
  asyncHandler(adminController.getForumThreads)
);

// Delete forum thread
router.delete(
  '/forum/threads/:id',
  validate(contentIdSchema, 'params'),
  validate(deleteContentSchema),
  asyncHandler(adminController.deleteForumThread)
);

// Toggle thread pin
router.post(
  '/forum/threads/:id/pin',
  validate(contentIdSchema, 'params'),
  asyncHandler(adminController.toggleThreadPin)
);

// Toggle thread lock
router.post(
  '/forum/threads/:id/lock',
  validate(contentIdSchema, 'params'),
  asyncHandler(adminController.toggleThreadLock)
);

export default router;
