import { Router } from 'express';
import { usersController } from '../controllers/users.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  updateProfileSchema,
  getUserProfileSchema,
  userIdParamSchema,
  searchUsersSchema,
} from '../validators/users';

const router = Router();

// Search users (authenticated)
router.get(
  '/search',
  authenticate,
  validate(searchUsersSchema, 'query'),
  asyncHandler(usersController.searchUsers)
);

// Get blocked users (authenticated)
router.get(
  '/blocked',
  authenticate,
  asyncHandler(usersController.getBlockedUsers)
);

// Update own profile (authenticated)
router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(usersController.updateProfile)
);

// Get user profile by username (optionally authenticated)
router.get(
  '/:username',
  optionalAuth,
  validate(getUserProfileSchema, 'params'),
  asyncHandler(usersController.getProfile)
);

// Get user followers (authenticated)
router.get(
  '/:id/followers',
  authenticate,
  validate(userIdParamSchema, 'params'),
  asyncHandler(usersController.getFollowers)
);

// Get user following (authenticated)
router.get(
  '/:id/following',
  authenticate,
  validate(userIdParamSchema, 'params'),
  asyncHandler(usersController.getFollowing)
);

// Follow user (authenticated)
router.post(
  '/:id/follow',
  authenticate,
  validate(userIdParamSchema, 'params'),
  asyncHandler(usersController.follow)
);

// Unfollow user (authenticated)
router.delete(
  '/:id/follow',
  authenticate,
  validate(userIdParamSchema, 'params'),
  asyncHandler(usersController.unfollow)
);

// Block user (authenticated)
router.post(
  '/:id/block',
  authenticate,
  validate(userIdParamSchema, 'params'),
  asyncHandler(usersController.block)
);

// Unblock user (authenticated)
router.delete(
  '/:id/block',
  authenticate,
  validate(userIdParamSchema, 'params'),
  asyncHandler(usersController.unblock)
);

export default router;
