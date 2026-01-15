import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import {
  RegisterInput,
  LoginInput,
  VerifyOtpInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ResendOtpInput,
  ChangePasswordInput,
} from '../validators/auth';

export const authController = {
  async register(req: Request<object, object, RegisterInput>, res: Response) {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  },

  async verifyOtp(req: Request<object, object, VerifyOtpInput>, res: Response) {
    const result = await authService.verifyOtp(req.body);

    res.json({
      success: true,
      data: result,
    });
  },

  async login(req: Request<object, object, LoginInput>, res: Response) {
    const result = await authService.login(req.body);

    res.json({
      success: true,
      data: result,
    });
  },

  async refreshToken(req: Request<object, object, RefreshTokenInput>, res: Response) {
    const result = await authService.refreshToken(req.body.refreshToken);

    res.json({
      success: true,
      data: { tokens: result },
    });
  },

  async logout(req: Request, res: Response) {
    const userId = req.user!.userId;
    const refreshToken = req.body.refreshToken;

    await authService.logout(userId, refreshToken);

    res.json({
      success: true,
      data: { message: 'გამოსვლა წარმატებულია' },
    });
  },

  async forgotPassword(req: Request<object, object, ForgotPasswordInput>, res: Response) {
    const result = await authService.forgotPassword(req.body);

    res.json({
      success: true,
      data: result,
    });
  },

  async resetPassword(req: Request<object, object, ResetPasswordInput>, res: Response) {
    const result = await authService.resetPassword(req.body);

    res.json({
      success: true,
      data: result,
    });
  },

  async resendOtp(req: Request<object, object, ResendOtpInput>, res: Response) {
    const result = await authService.resendOtp(req.body.userId, req.body.type);

    res.json({
      success: true,
      data: result,
    });
  },

  async getMe(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await authService.getMe(userId);

    res.json({
      success: true,
      data: result,
    });
  },

  async changePassword(req: Request<object, object, ChangePasswordInput>, res: Response) {
    const userId = req.user!.userId;
    const result = await authService.changePassword(userId, req.body);

    res.json({
      success: true,
      data: result,
    });
  },
};
