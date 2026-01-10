import { prisma } from '../config/database';
import { OtpType } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password';
import { generateTokens, verifyRefreshToken, TokenPair } from '../utils/jwt';
import { generateOtpCode, getOtpExpiryDate, isOtpExpired } from '../utils/otp';
import {
  RegisterInput,
  LoginInput,
  VerifyOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validators/auth';
import { AppError } from '../middleware/error-handler';
import { emailService } from './email.service';

interface RegisterResult {
  userId: string;
  message: string;
}

interface LoginResult {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  tokens: TokenPair;
}

interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  username: string;
  fullName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  isVerified: boolean;
  createdAt: Date;
}

export const authService = {
  async register(data: RegisterInput): Promise<RegisterResult> {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
          { username: data.username },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === data.username) {
        throw new AppError(409, 'CONFLICT', 'ეს username უკვე დაკავებულია');
      }
      if (data.email && existingUser.email === data.email) {
        throw new AppError(409, 'CONFLICT', 'ეს ელ.ფოსტა უკვე რეგისტრირებულია');
      }
      if (data.phone && existingUser.phone === data.phone) {
        throw new AppError(409, 'CONFLICT', 'ეს ტელეფონი უკვე რეგისტრირებულია');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        username: data.username,
        fullName: data.fullName,
      },
    });

    // Generate OTP
    const otpCode = generateOtpCode();
    const otpType = data.email ? OtpType.EMAIL : OtpType.PHONE;

    await prisma.otpCode.create({
      data: {
        userId: user.id,
        code: otpCode,
        type: otpType,
        expiresAt: getOtpExpiryDate(),
      },
    });

    // Send OTP via email
    if (data.email) {
      await emailService.sendOtp(data.email, otpCode);
    }
    // TODO: Add SMS support for phone

    return {
      userId: user.id,
      message: `OTP გაიგზავნა ${data.email ? 'ელ.ფოსტაზე' : 'ტელეფონზე'}`,
    };
  },

  async verifyOtp(data: VerifyOtpInput): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    if (user.isVerified) {
      throw new AppError(400, 'ALREADY_VERIFIED', 'ანგარიში უკვე დადასტურებულია');
    }

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId: data.userId,
        type: data.type as OtpType,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(404, 'NOT_FOUND', 'OTP კოდი ვერ მოიძებნა');
    }

    if (isOtpExpired(otpRecord.expiresAt)) {
      throw new AppError(400, 'OTP_EXPIRED', 'OTP კოდს ვადა გაუვიდა');
    }

    if (otpRecord.code !== data.code) {
      throw new AppError(400, 'INVALID_OTP', 'არასწორი OTP კოდი');
    }

    // Mark OTP as used and verify user
    await prisma.$transaction([
      prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      }),
      prisma.user.update({
        where: { id: data.userId },
        data: { isVerified: true },
      }),
    ]);

    // Generate tokens
    const tokens = generateTokens({ userId: user.id, role: user.role });

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isVerified: true,
      },
      tokens,
    };
  },

  async login(data: LoginInput): Promise<LoginResult> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'არასწორი მონაცემები');
    }

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'ანგარიში დაბლოკილია');
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'არასწორი მონაცემები');
    }

    if (!user.isVerified) {
      // Generate new OTP for unverified users
      const otpCode = generateOtpCode();
      const otpType = user.email ? OtpType.EMAIL : OtpType.PHONE;

      await prisma.otpCode.create({
        data: {
          userId: user.id,
          code: otpCode,
          type: otpType,
          expiresAt: getOtpExpiryDate(),
        },
      });

      // Send OTP via email
      if (user.email) {
        await emailService.sendOtp(user.email, otpCode);
      }

      throw new AppError(403, 'NOT_VERIFIED', 'გთხოვთ დაადასტუროთ ანგარიში. ახალი კოდი გაიგზავნა.');
    }

    // Generate tokens
    const tokens = generateTokens({ userId: user.id, role: user.role });

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
      tokens,
    };
  },

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError(401, 'INVALID_TOKEN', 'არასწორი refresh token');
    }

    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: payload.userId,
        isRevoked: false,
      },
    });

    if (!tokenRecord) {
      throw new AppError(401, 'INVALID_TOKEN', 'Refresh token არ არის ვალიდური');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token-ს ვადა გაუვიდა');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Revoke old token and create new one
    const tokens = generateTokens({ userId: user.id, role: user.role });

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return tokens;
  },

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all tokens
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }
  },

  async forgotPassword(data: ForgotPasswordInput): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return { message: 'თუ ანგარიში არსებობს, კოდი გაიგზავნება' };
    }

    const otpCode = generateOtpCode();

    await prisma.otpCode.create({
      data: {
        userId: user.id,
        code: otpCode,
        type: OtpType.PASSWORD_RESET,
        expiresAt: getOtpExpiryDate(),
      },
    });

    // Send OTP via email
    if (data.email && user.email) {
      await emailService.sendPasswordResetOtp(user.email, otpCode);
    }
    // TODO: Add SMS support for phone

    return { message: 'თუ ანგარიში არსებობს, კოდი გაიგზავნება' };
  },

  async resetPassword(data: ResetPasswordInput): Promise<{ message: string }> {
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId: data.userId,
        type: OtpType.PASSWORD_RESET,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new AppError(404, 'NOT_FOUND', 'კოდი ვერ მოიძებნა');
    }

    if (isOtpExpired(otpRecord.expiresAt)) {
      throw new AppError(400, 'OTP_EXPIRED', 'კოდს ვადა გაუვიდა');
    }

    if (otpRecord.code !== data.code) {
      throw new AppError(400, 'INVALID_OTP', 'არასწორი კოდი');
    }

    const passwordHash = await hashPassword(data.newPassword);

    await prisma.$transaction([
      prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      }),
      prisma.user.update({
        where: { id: data.userId },
        data: { passwordHash },
      }),
      // Revoke all refresh tokens for security
      prisma.refreshToken.updateMany({
        where: { userId: data.userId },
        data: { isRevoked: true },
      }),
    ]);

    return { message: 'პაროლი წარმატებით შეიცვალა' };
  },

  async resendOtp(userId: string, type: 'EMAIL' | 'PHONE'): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check rate limit - max 1 OTP per minute
    const recentOtp = await prisma.otpCode.findFirst({
      where: {
        userId,
        type: type as OtpType,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentOtp) {
      throw new AppError(429, 'RATE_LIMITED', 'გთხოვთ დაიცადოთ 1 წუთი');
    }

    const otpCode = generateOtpCode();

    await prisma.otpCode.create({
      data: {
        userId,
        code: otpCode,
        type: type as OtpType,
        expiresAt: getOtpExpiryDate(),
      },
    });

    // Send OTP via email
    if (type === 'EMAIL' && user.email) {
      await emailService.sendOtp(user.email, otpCode);
    }
    // TODO: Add SMS support for phone

    return { message: 'ახალი კოდი გაიგზავნა' };
  },

  async getMe(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        location: true,
        website: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    return user;
  },
};
