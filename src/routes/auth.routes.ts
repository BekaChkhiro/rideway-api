import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate } from '../middleware/auth';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendOtpSchema,
  changePasswordSchema,
} from '../validators/auth';

const router = Router();

// Public routes
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(authController.register)
);

router.post(
  '/verify-otp',
  validate(verifyOtpSchema),
  asyncHandler(authController.verifyOtp)
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(authController.login)
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(authController.refreshToken)
);

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

router.post(
  '/resend-otp',
  validate(resendOtpSchema),
  asyncHandler(authController.resendOtp)
);

// Protected routes
router.post('/logout', authenticate, asyncHandler(authController.logout));

router.get('/me', authenticate, asyncHandler(authController.getMe));

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

export default router;
