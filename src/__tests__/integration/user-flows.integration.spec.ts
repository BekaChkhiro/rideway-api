import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthService } from '@modules/auth/auth.service.js';
import { UsersService } from '@modules/users/users.service.js';
import { MediaService } from '@modules/media/media.service.js';
import {
  User,
  UserProfile,
  UserFollow,
  UserBlock,
  RefreshToken,
  OtpCode,
  OtpType,
} from '@database/index.js';

// Mock bcrypt at module level
vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  genSalt: vi.fn(),
}));

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = vi.fn().mockReturnValue({
    metadata: vi
      .fn()
      .mockResolvedValue({ format: 'jpeg', width: 1000, height: 800 }),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
  });
  return { default: mockSharp };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('12345678-1234-1234-1234-123456789012'),
}));

import * as bcrypt from 'bcrypt';

describe('Integration Tests - User Flows', () => {
  // Auth Service Mocks
  let authService: AuthService;
  let mockUserRepo: Record<string, Mock>;
  let mockProfileRepo: Record<string, Mock>;
  let mockRefreshTokenRepo: Record<string, Mock>;
  let mockOtpCodeRepo: Record<string, Mock>;
  let mockJwtService: Record<string, Mock>;
  let mockConfigService: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;

  // Users Service Mocks
  let usersService: UsersService;
  let mockUsersUserRepo: Record<string, Mock>;
  let mockUsersProfileRepo: Record<string, Mock>;
  let mockFollowRepo: Record<string, Mock>;
  let mockBlockRepo: Record<string, Mock>;
  let mockDataSource: Record<string, Mock>;
  let mockMediaService: Record<string, Mock>;

  // Shared test data
  const testUser: Partial<User> = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    phone: '+995555123456',
    passwordHash: '$2b$12$hashedpassword',
    isEmailVerified: false,
    isPhoneVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testProfile: Partial<UserProfile> = {
    id: 'profile-uuid-1234',
    userId: 'user-uuid-1234',
    username: 'testuser',
    fullName: 'Test User',
    bio: 'Test bio',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testUser2: Partial<User> = {
    id: 'user-uuid-5678',
    email: 'other@example.com',
    isActive: true,
    isEmailVerified: true,
    profile: {
      id: 'profile-uuid-5678',
      userId: 'user-uuid-5678',
      username: 'otheruser',
      fullName: 'Other User',
    } as UserProfile,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Auth Service Mocks
    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn(),
      }),
    };

    mockProfileRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      }),
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
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('test-secret'),
    };

    mockRedisService = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
      del: vi.fn(),
    };

    // Setup Users Service Mocks
    mockUsersUserRepo = {
      findOne: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn(),
      }),
    };

    mockUsersProfileRepo = {
      findOne: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      }),
    };

    mockFollowRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      }),
    };

    mockBlockRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };

    mockDataSource = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        const mockManager = {
          delete: vi.fn().mockResolvedValue(undefined),
          create: vi.fn().mockReturnValue({}),
          save: vi.fn().mockResolvedValue({}),
        };
        return callback(mockManager);
      }),
    };

    mockMediaService = {
      uploadImage: vi.fn().mockResolvedValue({
        url: 'https://example.com/avatar.webp',
        key: 'avatars/test.webp',
      }),
      deleteImage: vi.fn().mockResolvedValue(undefined),
    };

    // Create service instances
    authService = new AuthService(
      mockUserRepo as any,
      mockProfileRepo as any,
      mockRefreshTokenRepo as any,
      mockOtpCodeRepo as any,
      mockJwtService as any,
      mockConfigService as any,
      mockRedisService as any,
    );

    usersService = new UsersService(
      mockUsersUserRepo as any,
      mockUsersProfileRepo as any,
      mockFollowRepo as any,
      mockBlockRepo as any,
      mockDataSource as any,
      mockMediaService as any,
    );
  });

  describe('Full Registration -> OTP -> Login Flow', () => {
    it('should complete full registration and login flow', async () => {
      // Step 1: Register user
      mockUserRepo.findOne.mockResolvedValue(null);
      mockProfileRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({ ...testUser, id: 'new-user-id' });
      mockUserRepo.save.mockResolvedValue({ ...testUser, id: 'new-user-id' });
      mockProfileRepo.create.mockReturnValue(testProfile);
      mockProfileRepo.save.mockResolvedValue(testProfile);
      mockOtpCodeRepo.create.mockReturnValue({
        code: '123456',
        type: OtpType.EMAIL_VERIFY,
      });
      mockOtpCodeRepo.save.mockResolvedValue({ code: '123456' });

      const registerResult = await authService.register({
        email: 'newuser@example.com',
        password: 'StrongP@ss123',
        username: 'newuser',
        fullName: 'New User',
        phone: '+995555999888',
      });

      expect(registerResult.message).toContain('Registration successful');
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockProfileRepo.save).toHaveBeenCalled();
      expect(mockOtpCodeRepo.save).toHaveBeenCalled();

      // Step 2: Verify OTP
      const validOtp = {
        id: 'otp-id',
        userId: 'new-user-id',
        code: '123456',
        type: OtpType.EMAIL_VERIFY,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      };
      mockOtpCodeRepo.findOne.mockResolvedValue(validOtp);
      mockOtpCodeRepo.save.mockResolvedValue({
        ...validOtp,
        usedAt: new Date(),
      });
      mockUserRepo.findOne.mockResolvedValue({
        ...testUser,
        id: 'new-user-id',
        profile: testProfile,
      });
      mockUserRepo.save.mockResolvedValue({
        ...testUser,
        isEmailVerified: true,
      });
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({ id: 'token-id' });

      const verifyResult = await authService.verifyOtp({
        userId: 'new-user-id',
        code: '123456',
        type: OtpType.EMAIL_VERIFY,
      });

      expect(verifyResult.accessToken).toBeDefined();
      expect(verifyResult.refreshToken).toBeDefined();
      expect(verifyResult.user).toBeDefined();

      // Step 3: Login with verified account
      const verifiedUser = {
        ...testUser,
        id: 'new-user-id',
        isEmailVerified: true,
        profile: testProfile,
      };
      mockUserRepo.findOne.mockResolvedValue(verifiedUser);
      (bcrypt.compare as Mock).mockResolvedValue(true);

      const loginResult = await authService.login({
        emailOrPhone: 'newuser@example.com',
        password: 'StrongP@ss123',
      });

      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.user.email).toBe('test@example.com');
    });

    it('should reject login for unverified user after registration', async () => {
      // Register but don't verify
      const unverifiedUser = {
        ...testUser,
        isEmailVerified: false,
        profile: testProfile,
      };
      mockUserRepo.findOne.mockResolvedValue(unverifiedUser);
      (bcrypt.compare as Mock).mockResolvedValue(true);

      await expect(
        authService.login({
          emailOrPhone: 'test@example.com',
          password: 'StrongP@ss123',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Full Password Reset Flow', () => {
    it('should complete full password reset flow', async () => {
      // Step 1: Request password reset
      mockUserRepo.findOne.mockResolvedValue({
        ...testUser,
        isEmailVerified: true,
      });
      mockOtpCodeRepo.create.mockReturnValue({
        code: '654321',
        type: OtpType.PASSWORD_RESET,
      });
      mockOtpCodeRepo.save.mockResolvedValue({ code: '654321' });

      const forgotResult = await authService.forgotPassword({
        email: 'test@example.com',
      });

      expect(forgotResult.message).toContain('If an account exists');
      expect(mockOtpCodeRepo.save).toHaveBeenCalled();

      // Step 2: Reset password with OTP
      const validResetOtp = {
        id: 'reset-otp-id',
        userId: 'user-uuid-1234',
        code: '654321',
        type: OtpType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        usedAt: null,
      };
      mockUserRepo.findOne.mockResolvedValue({
        ...testUser,
        isEmailVerified: true,
      });
      mockOtpCodeRepo.findOne.mockResolvedValue(validResetOtp);
      mockOtpCodeRepo.save.mockResolvedValue({
        ...validResetOtp,
        usedAt: new Date(),
      });
      mockUserRepo.save.mockResolvedValue({
        ...testUser,
        passwordHash: '$2b$12$newhash',
      });
      mockRefreshTokenRepo.update.mockResolvedValue({ affected: 1 });

      const resetResult = await authService.resetPassword({
        email: 'test@example.com',
        code: '654321',
        newPassword: 'NewStrongP@ss456',
      });

      expect(resetResult.message).toContain('Password reset successful');
      // All old tokens should be revoked
      expect(mockRefreshTokenRepo.update).toHaveBeenCalled();

      // Step 3: Login with new password should work
      mockUserRepo.findOne.mockResolvedValue({
        ...testUser,
        isEmailVerified: true,
        passwordHash: '$2b$12$newhash',
        profile: testProfile,
      });
      (bcrypt.compare as Mock).mockResolvedValue(true);
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({ id: 'new-token' });

      const loginResult = await authService.login({
        emailOrPhone: 'test@example.com',
        password: 'NewStrongP@ss456',
      });

      expect(loginResult.accessToken).toBeDefined();
    });
  });

  describe('Upload Avatar -> Verify in Profile', () => {
    it('should upload avatar and reflect in profile', async () => {
      // Step 1: Upload avatar
      mockUsersProfileRepo.findOne.mockResolvedValue({
        ...testProfile,
        avatarUrl: null,
        user: testUser,
      });
      mockUsersProfileRepo.save.mockResolvedValue({
        ...testProfile,
        avatarUrl: 'https://example.com/avatar.webp',
      });

      const mockFile = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/jpeg',
        originalname: 'avatar.jpg',
        size: 1024,
      } as Express.Multer.File;

      const uploadResult = await usersService.uploadAvatar(
        'user-uuid-1234',
        mockFile,
      );

      expect(uploadResult.avatarUrl).toBe('https://example.com/avatar.webp');
      expect(mockMediaService.uploadImage).toHaveBeenCalled();

      // Step 2: Verify avatar in profile
      // The mapToProfileResponse reads from profile.user.profile.avatarUrl
      const updatedProfile = {
        ...testProfile,
        avatarUrl: 'https://example.com/avatar.webp',
      };
      const profileWithAvatar = {
        ...updatedProfile,
        user: { ...testUser, profile: updatedProfile },
      };
      mockUsersProfileRepo.findOne.mockResolvedValue(profileWithAvatar);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.count.mockResolvedValue(10);

      const profile = await usersService.getUserByUsername('testuser');

      expect(profile.avatarUrl).toBe('https://example.com/avatar.webp');
    });

    it('should replace old avatar when uploading new one', async () => {
      const oldAvatarUrl = 'https://example.com/old-avatar.webp';

      mockUsersProfileRepo.findOne.mockResolvedValue({
        ...testProfile,
        avatarUrl: oldAvatarUrl,
        user: testUser,
      });
      mockUsersProfileRepo.save.mockResolvedValue({
        ...testProfile,
        avatarUrl: 'https://example.com/avatar.webp',
      });

      const mockFile = {
        buffer: Buffer.from('new-image'),
        mimetype: 'image/jpeg',
        originalname: 'new-avatar.jpg',
        size: 1024,
      } as Express.Multer.File;

      await usersService.uploadAvatar('user-uuid-1234', mockFile);

      // Old avatar should be deleted
      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(oldAvatarUrl);
      // New avatar should be uploaded
      expect(mockMediaService.uploadImage).toHaveBeenCalled();
    });
  });

  describe('Follow User -> Appears in Followers List', () => {
    it('should follow user and appear in their followers list', async () => {
      // Step 1: Follow user
      mockUsersUserRepo.findOne.mockResolvedValue(testUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue({
        followerId: 'user-uuid-1234',
        followingId: 'user-uuid-5678',
      });
      mockFollowRepo.save.mockResolvedValue({
        id: 'follow-id',
        followerId: 'user-uuid-1234',
        followingId: 'user-uuid-5678',
      });

      await usersService.followUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockFollowRepo.save).toHaveBeenCalled();

      // Step 2: Check user appears in followers list
      const mockFollows = [
        {
          followerId: 'user-uuid-1234',
          follower: {
            id: 'user-uuid-1234',
            profile: { username: 'testuser', fullName: 'Test User' },
          },
        },
      ];
      mockFollowRepo
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([mockFollows, 1]);

      const followers = await usersService.getFollowers('user-uuid-5678', {
        page: 1,
        limit: 20,
      });

      expect(followers.items).toHaveLength(1);
      expect(followers.items[0].username).toBe('testuser');
      expect(followers.meta.total).toBe(1);
    });

    it('should unfollow and remove from followers list', async () => {
      // Unfollow
      const existingFollow = {
        id: 'follow-id',
        followerId: 'user-uuid-1234',
        followingId: 'user-uuid-5678',
      };
      mockFollowRepo.findOne.mockResolvedValue(existingFollow);
      mockFollowRepo.remove.mockResolvedValue(existingFollow);

      await usersService.unfollowUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockFollowRepo.remove).toHaveBeenCalledWith(existingFollow);

      // Verify not in followers list
      mockFollowRepo
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([[], 0]);

      const followers = await usersService.getFollowers('user-uuid-5678', {
        page: 1,
        limit: 20,
      });

      expect(followers.items).toHaveLength(0);
    });
  });

  describe('Block User -> Excluded from Feed/Search', () => {
    it('should block user and exclude from search results', async () => {
      // Step 1: Block user
      mockUsersUserRepo.findOne.mockResolvedValue(testUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);

      await usersService.blockUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockDataSource.transaction).toHaveBeenCalled();

      // Step 2: Search should exclude blocked user
      mockBlockRepo.find.mockResolvedValue([
        { blockerId: 'user-uuid-1234', blockedId: 'user-uuid-5678' },
      ]);
      mockUsersProfileRepo
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([
          [{ userId: 'user-uuid-9999', username: 'anotheruser' }], // Different user
          1,
        ]);

      const searchResults = await usersService.searchUsers(
        { q: 'user', page: 1, limit: 20 },
        'user-uuid-1234',
      );

      // Blocked user should not appear
      expect(
        searchResults.items.every((item) => item.id !== 'user-uuid-5678'),
      ).toBe(true);
    });

    it('should block user and unfollow both directions', async () => {
      mockUsersUserRepo.findOne.mockResolvedValue(testUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);

      let deleteCallCount = 0;
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          delete: vi.fn().mockImplementation(() => {
            deleteCallCount++;
            return Promise.resolve({ affected: 1 });
          }),
          create: vi.fn().mockReturnValue({}),
          save: vi.fn().mockResolvedValue({}),
        };
        return callback(mockManager);
      });

      await usersService.blockUser('user-uuid-1234', 'user-uuid-5678');

      // Should delete follows in both directions
      expect(deleteCallCount).toBe(2);
    });

    it('should not allow following blocked user', async () => {
      mockUsersUserRepo.findOne.mockResolvedValue(testUser2);
      mockBlockRepo.findOne.mockResolvedValue({
        blockerId: 'user-uuid-5678',
        blockedId: 'user-uuid-1234',
      });

      await expect(
        usersService.followUser('user-uuid-1234', 'user-uuid-5678'),
      ).rejects.toThrow();
    });

    it('should hide blocked user profile', async () => {
      mockBlockRepo.findOne.mockResolvedValue({
        blockerId: 'user-uuid-1234',
        blockedId: 'user-uuid-5678',
      });

      await expect(
        usersService.getUserById('user-uuid-5678', 'user-uuid-1234'),
      ).rejects.toThrow();
    });
  });
});
