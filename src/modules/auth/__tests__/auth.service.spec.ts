import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import {
  User,
  UserProfile,
  RefreshToken,
  OtpCode,
  OtpType,
} from '@database/index.js';

// Mock bcrypt at module level
vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
  genSalt: vi.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: Record<string, Mock>;
  let mockProfileRepo: Record<string, Mock>;
  let mockRefreshTokenRepo: Record<string, Mock>;
  let mockOtpCodeRepo: Record<string, Mock>;
  let mockJwtService: Record<string, Mock>;
  let mockConfigService: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    phone: '+995555123456',
    passwordHash: '$2b$12$hashedpassword',
    isEmailVerified: true,
    isPhoneVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: 'profile-uuid-1234',
      userId: 'user-uuid-1234',
      username: 'testuser',
      fullName: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserProfile,
  };

  const mockOtpCode: Partial<OtpCode> = {
    id: 'otp-uuid-1234',
    userId: 'user-uuid-1234',
    code: '123456',
    type: OtpType.EMAIL_VERIFY,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    usedAt: undefined,
  };

  const mockRefreshToken: Partial<RefreshToken> = {
    id: 'token-uuid-1234',
    userId: 'user-uuid-1234',
    tokenHash: '$2b$12$hashedtoken',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: undefined,
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    mockProfileRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    mockRefreshTokenRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    mockOtpCodeRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
      decode: vi.fn(),
      verify: vi.fn(),
      signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
      verifyAsync: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('test-secret'),
      getOrThrow: vi.fn().mockReturnValue('test-secret'),
    };

    mockRedisService = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
      del: vi.fn(),
    };

    // Create service instance manually to bypass NestJS DI issues with Vitest
    service = new AuthService(
      mockUserRepo as any,
      mockProfileRepo as any,
      mockRefreshTokenRepo as any,
      mockOtpCodeRepo as any,
      mockJwtService as any,
      mockConfigService as any,
      mockRedisService as any,
    );
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'StrongP@ss123',
      username: 'newuser',
      fullName: 'New User',
      phone: '+995555111222',
    };

    it('should create user and profile successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({
        id: 'new-uuid',
        ...registerDto,
      } as unknown as User);
      mockUserRepo.save.mockResolvedValue({
        id: 'new-uuid',
        ...registerDto,
      } as unknown as User);
      mockProfileRepo.create.mockReturnValue({
        userId: 'new-uuid',
        username: registerDto.username,
        fullName: registerDto.fullName,
      } as UserProfile);
      mockProfileRepo.save.mockResolvedValue({
        userId: 'new-uuid',
        username: registerDto.username,
      } as UserProfile);
      mockOtpCodeRepo.create.mockReturnValue({} as OtpCode);
      mockOtpCodeRepo.save.mockResolvedValue({} as OtpCode);
      (bcrypt.hash as Mock).mockResolvedValue('$2b$12$hashedpassword');

      const result = await service.register(registerDto);

      expect(result.message).toBe(
        'Registration successful. Please verify your email.',
      );
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockProfileRepo.save).toHaveBeenCalled();
      expect(mockOtpCodeRepo.save).toHaveBeenCalled();
    });

    it('should fail with duplicate email', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        email: registerDto.email,
      } as User);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should fail with duplicate phone', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        phone: registerDto.phone,
      } as User);

      await expect(
        service.register({ ...registerDto, email: 'other@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should fail with duplicate username', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue({
        username: registerDto.username,
      } as UserProfile);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('verifyOtp', () => {
    const verifyDto = {
      userId: 'user-uuid-1234',
      code: '123456',
      type: OtpType.EMAIL_VERIFY,
    };

    it('should verify OTP and return tokens', async () => {
      mockOtpCodeRepo.findOne.mockResolvedValue(mockOtpCode as OtpCode);
      mockOtpCodeRepo.save.mockResolvedValue({} as OtpCode);
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockUserRepo.save.mockResolvedValue(mockUser as User);
      mockRefreshTokenRepo.create.mockReturnValue(
        mockRefreshToken as RefreshToken,
      );
      mockRefreshTokenRepo.save.mockResolvedValue(
        mockRefreshToken as RefreshToken,
      );
      (bcrypt.hash as Mock).mockResolvedValue('$2b$12$hashedtoken');

      const result = await service.verifyOtp(verifyDto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should fail with invalid OTP', async () => {
      mockOtpCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fail with already used OTP', async () => {
      mockOtpCodeRepo.findOne.mockResolvedValue({
        ...mockOtpCode,
        usedAt: new Date(),
      } as OtpCode);

      await expect(service.verifyOtp(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fail with expired OTP', async () => {
      mockOtpCodeRepo.findOne.mockResolvedValue({
        ...mockOtpCode,
        expiresAt: new Date(Date.now() - 1000),
      } as OtpCode);

      await expect(service.verifyOtp(verifyDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      emailOrPhone: 'test@example.com',
      password: 'StrongP@ss123',
    };

    it('should return tokens for verified user', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockUserRepo.save.mockResolvedValue(mockUser as User);
      mockRefreshTokenRepo.create.mockReturnValue(
        mockRefreshToken as RefreshToken,
      );
      mockRefreshTokenRepo.save.mockResolvedValue(
        mockRefreshToken as RefreshToken,
      );
      (bcrypt.compare as Mock).mockResolvedValue(true);
      (bcrypt.hash as Mock).mockResolvedValue('$2b$12$hashedtoken');

      const result = await service.login(loginDto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should fail for unverified user', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
      } as User);
      (bcrypt.compare as Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should fail with wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      (bcrypt.compare as Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should fail for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should fail for deactivated user', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as User);
      (bcrypt.compare as Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens with valid refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(
        mockRefreshToken as RefreshToken,
      );
      mockRefreshTokenRepo.save.mockResolvedValue(
        mockRefreshToken as RefreshToken,
      );
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockRefreshTokenRepo.create.mockReturnValue(
        mockRefreshToken as RefreshToken,
      );
      (bcrypt.compare as Mock).mockResolvedValue(true);
      (bcrypt.hash as Mock).mockResolvedValue('$2b$12$hashedtoken');

      const result = await service.refreshTokens(
        'user-uuid-1234',
        'token-uuid-1234',
        'valid-refresh-token',
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should fail with revoked refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({
        ...mockRefreshToken,
        revokedAt: new Date(),
      } as RefreshToken);

      await expect(
        service.refreshTokens(
          'user-uuid-1234',
          'token-uuid-1234',
          'revoked-token',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fail with expired refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      } as RefreshToken);

      await expect(
        service.refreshTokens(
          'user-uuid-1234',
          'token-uuid-1234',
          'expired-token',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fail with invalid refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-uuid-1234', 'invalid-id', 'invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token', async () => {
      mockJwtService.decode.mockReturnValue({ tokenId: 'token-uuid-1234' });
      mockRefreshTokenRepo.update.mockResolvedValue({ affected: 1 });

      await service.logout('user-uuid-1234', 'mock-refresh-token');

      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { id: 'token-uuid-1234', userId: 'user-uuid-1234' },
        { revokedAt: expect.any(Date) },
      );
    });

    it('should revoke all tokens when no refresh token provided', async () => {
      mockRefreshTokenRepo.update.mockResolvedValue({ affected: 5 });

      await service.logout('user-uuid-1234');

      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-uuid-1234', revokedAt: undefined },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('forgotPassword', () => {
    it('should generate OTP for existing user', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockOtpCodeRepo.create.mockReturnValue({} as OtpCode);
      mockOtpCodeRepo.save.mockResolvedValue({} as OtpCode);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result.message).toContain('If an account exists');
      expect(mockOtpCodeRepo.save).toHaveBeenCalled();
    });

    it('should return same message for non-existent user (security)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });

      expect(result.message).toContain('If an account exists');
      expect(mockOtpCodeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      email: 'test@example.com',
      code: '123456',
      newPassword: 'NewStrongP@ss123',
    };

    it('should reset password with valid OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockOtpCodeRepo.findOne.mockResolvedValue({
        id: 'otp-uuid-reset',
        userId: 'user-uuid-1234',
        code: '123456',
        type: OtpType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null, // Important: must be null/undefined for unused OTP
      } as unknown as OtpCode);
      mockOtpCodeRepo.save.mockResolvedValue({} as OtpCode);
      mockUserRepo.save.mockResolvedValue(mockUser as User);
      mockRefreshTokenRepo.update.mockResolvedValue({ affected: 1 });
      (bcrypt.hash as Mock).mockResolvedValue('$2b$12$newhashedpassword');

      const result = await service.resetPassword(resetDto);

      expect(result.message).toContain('Password reset successful');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalled();
    });

    it('should fail with invalid OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockOtpCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fail with expired OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser as User);
      mockOtpCodeRepo.findOne.mockResolvedValue({
        ...mockOtpCode,
        type: OtpType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() - 1000),
      } as OtpCode);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('token blacklist', () => {
    it('should blacklist token', async () => {
      await service.blacklistToken('some-token', 900);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'token:blacklist:some-token',
        '1',
        900,
      );
    });

    it('should check if token is blacklisted', async () => {
      mockRedisService.exists.mockResolvedValue(true);

      const result = await service.isTokenBlacklisted('blacklisted-token');

      expect(result).toBe(true);
      expect(mockRedisService.exists).toHaveBeenCalledWith(
        'token:blacklist:blacklisted-token',
      );
    });
  });
});
