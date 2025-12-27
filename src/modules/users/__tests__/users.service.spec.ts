import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users.service.js';
import { User, UserProfile, UserFollow, UserBlock } from '@database/index.js';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepo: Record<string, Mock>;
  let mockProfileRepo: Record<string, Mock>;
  let mockFollowRepo: Record<string, Mock>;
  let mockBlockRepo: Record<string, Mock>;
  let mockDataSource: Record<string, Mock>;
  let mockMediaService: Record<string, Mock>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: 'profile-uuid-1234',
      userId: 'user-uuid-1234',
      username: 'testuser',
      fullName: 'Test User',
      bio: 'Test bio',
      avatarUrl: 'https://example.com/avatar.jpg',
      coverUrl: 'https://example.com/cover.jpg',
      location: 'Tbilisi',
      website: 'https://example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserProfile,
  };

  const mockProfile: Partial<UserProfile> = {
    id: 'profile-uuid-1234',
    userId: 'user-uuid-1234',
    username: 'testuser',
    fullName: 'Test User',
    bio: 'Test bio',
    avatarUrl: 'https://example.com/avatar.jpg',
    user: mockUser as User,
  };

  const mockUser2: Partial<User> = {
    id: 'user-uuid-5678',
    email: 'other@example.com',
    isActive: true,
    profile: {
      id: 'profile-uuid-5678',
      userId: 'user-uuid-5678',
      username: 'otheruser',
      fullName: 'Other User',
    } as UserProfile,
  };

  const mockFollow: Partial<UserFollow> = {
    id: 'follow-uuid-1234',
    followerId: 'user-uuid-1234',
    followingId: 'user-uuid-5678',
    createdAt: new Date(),
  };

  const mockBlock: Partial<UserBlock> = {
    id: 'block-uuid-1234',
    blockerId: 'user-uuid-1234',
    blockedId: 'user-uuid-5678',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock query builder for userRepository
    const mockUserQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
    };

    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(mockUserQueryBuilder),
    };

    mockProfileRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    // Create mock query builder for followRepository
    const mockFollowQueryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };

    mockFollowRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      createQueryBuilder: vi.fn().mockReturnValue(mockFollowQueryBuilder),
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
          create: vi.fn().mockReturnValue(mockBlock),
          save: vi.fn().mockResolvedValue(mockBlock),
        };
        return callback(mockManager);
      }),
    };

    mockMediaService = {
      uploadImage: vi.fn().mockResolvedValue({
        url: 'https://example.com/new-image.jpg',
        key: 'new-image-key',
      }),
      deleteImage: vi.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      mockUserRepo as any,
      mockProfileRepo as any,
      mockFollowRepo as any,
      mockBlockRepo as any,
      mockDataSource as any,
      mockMediaService as any,
    );
  });

  describe('getUserById', () => {
    it('should return user profile with correct data', async () => {
      mockBlockRepo.findOne.mockResolvedValue(null);
      const mockQueryBuilder = mockUserRepo.createQueryBuilder();
      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      mockFollowRepo.count.mockResolvedValue(10);

      const result = await service.getUserById('user-uuid-1234');

      expect(result.id).toBe('user-uuid-1234');
      expect(result.username).toBe('testuser');
      expect(result.fullName).toBe('Test User');
      expect(result.bio).toBe('Test bio');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      const mockQueryBuilder = mockUserRepo.createQueryBuilder();
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.getUserById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when viewing blocked user', async () => {
      mockBlockRepo.findOne.mockResolvedValue(mockBlock);

      await expect(
        service.getUserById('user-uuid-5678', 'user-uuid-1234'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.count.mockResolvedValue(5);

      const result = await service.getUserByUsername('testuser');

      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw NotFoundException for non-existent username', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.getUserByUsername('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when blocked', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockProfile);
      mockBlockRepo.findOne.mockResolvedValue(mockBlock);

      await expect(
        service.getUserByUsername('testuser', 'user-uuid-5678'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields correctly', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        user: mockUser,
      });
      mockProfileRepo.save.mockResolvedValue({
        ...mockProfile,
        fullName: 'Updated Name',
      });
      mockFollowRepo.count.mockResolvedValue(0);

      const result = await service.updateProfile('user-uuid-1234', {
        fullName: 'Updated Name',
        bio: 'Updated bio',
      });

      expect(mockProfileRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('user-uuid-1234');
    });

    it('should enforce username uniqueness', async () => {
      mockProfileRepo.findOne
        .mockResolvedValueOnce({ ...mockProfile, user: mockUser })
        .mockResolvedValueOnce({ username: 'takenusername' });

      await expect(
        service.updateProfile('user-uuid-1234', { username: 'takenusername' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow same username if unchanged', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        user: mockUser,
      });
      mockProfileRepo.save.mockResolvedValue(mockProfile);
      mockFollowRepo.count.mockResolvedValue(0);

      const result = await service.updateProfile('user-uuid-1234', {
        username: 'testuser', // same username
        bio: 'New bio',
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for non-existent profile', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent', { bio: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('followUser', () => {
    it('should create follow relationship', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue(mockFollow);
      mockFollowRepo.save.mockResolvedValue(mockFollow);

      await service.followUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockFollowRepo.create).toHaveBeenCalledWith({
        followerId: 'user-uuid-1234',
        followingId: 'user-uuid-5678',
      });
      expect(mockFollowRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when following self', async () => {
      await expect(
        service.followUser('user-uuid-1234', 'user-uuid-1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when following blocked user', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(mockBlock);

      await expect(
        service.followUser('user-uuid-1234', 'user-uuid-5678'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when already following', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.findOne.mockResolvedValue(mockFollow);

      await expect(
        service.followUser('user-uuid-1234', 'user-uuid-5678'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent target user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.followUser('user-uuid-1234', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unfollowUser', () => {
    it('should remove follow relationship', async () => {
      mockFollowRepo.findOne.mockResolvedValue(mockFollow);
      mockFollowRepo.remove.mockResolvedValue(mockFollow);

      await service.unfollowUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockFollowRepo.remove).toHaveBeenCalledWith(mockFollow);
    });

    it('should throw NotFoundException when not following', async () => {
      mockFollowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.unfollowUser('user-uuid-1234', 'user-uuid-5678'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFollowers', () => {
    it('should return paginated followers list', async () => {
      const mockFollows = [
        {
          followerId: 'follower-1',
          follower: {
            id: 'follower-1',
            profile: { username: 'follower1', fullName: 'Follower One' },
          },
        },
      ];
      const mockQueryBuilder = mockFollowRepo.createQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFollows, 1]);

      const result = await service.getFollowers('user-uuid-1234', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should handle empty followers list', async () => {
      const mockQueryBuilder = mockFollowRepo.createQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.getFollowers('user-uuid-1234', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getFollowing', () => {
    it('should return paginated following list', async () => {
      const mockFollows = [
        {
          followingId: 'following-1',
          following: {
            id: 'following-1',
            profile: { username: 'following1', fullName: 'Following One' },
          },
        },
      ];
      const mockQueryBuilder = mockFollowRepo.createQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockFollows, 1]);

      const result = await service.getFollowing('user-uuid-1234', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('blockUser', () => {
    it('should create block and remove follows', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);

      await service.blockUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when blocking self', async () => {
      await expect(
        service.blockUser('user-uuid-1234', 'user-uuid-1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when already blocked', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(mockBlock);

      await expect(
        service.blockUser('user-uuid-1234', 'user-uuid-5678'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.blockUser('user-uuid-1234', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unblockUser', () => {
    it('should remove block', async () => {
      mockBlockRepo.findOne.mockResolvedValue(mockBlock);
      mockBlockRepo.remove.mockResolvedValue(mockBlock);

      await service.unblockUser('user-uuid-1234', 'user-uuid-5678');

      expect(mockBlockRepo.remove).toHaveBeenCalledWith(mockBlock);
    });

    it('should throw NotFoundException when not blocked', async () => {
      mockBlockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.unblockUser('user-uuid-1234', 'user-uuid-5678'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchUsers', () => {
    it('should return search results', async () => {
      const mockProfiles = [
        { userId: 'user-1', username: 'searchuser1', fullName: 'Search User' },
      ];
      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([mockProfiles, 1]),
      };
      mockProfileRepo.createQueryBuilder = vi
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const result = await service.searchUsers({
        q: 'search',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].username).toBe('searchuser1');
    });

    it('should exclude blocked users from search', async () => {
      const mockProfiles = [{ userId: 'user-1', username: 'user1' }];
      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([mockProfiles, 1]),
      };
      mockProfileRepo.createQueryBuilder = vi
        .fn()
        .mockReturnValue(mockQueryBuilder);
      mockBlockRepo.find.mockResolvedValue([
        { blockerId: 'current-user', blockedId: 'blocked-user' },
      ]);

      const result = await service.searchUsers(
        { q: 'test', page: 1, limit: 20 },
        'current-user',
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should handle empty search results', async () => {
      const mockQueryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      mockProfileRepo.createQueryBuilder = vi
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const result = await service.searchUsers({
        q: 'nonexistent',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar and update profile', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        avatarUrl: null,
      });
      mockProfileRepo.save.mockResolvedValue({
        ...mockProfile,
        avatarUrl: 'https://example.com/new-avatar.jpg',
      });

      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        originalname: 'avatar.jpg',
      } as Express.Multer.File;

      const result = await service.uploadAvatar('user-uuid-1234', mockFile);

      expect(mockMediaService.uploadImage).toHaveBeenCalled();
      expect(mockProfileRepo.save).toHaveBeenCalled();
      expect(result.avatarUrl).toBeDefined();
    });

    it('should delete old avatar before uploading new one', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        avatarUrl: 'https://example.com/old-avatar.jpg',
      });
      mockProfileRepo.save.mockResolvedValue(mockProfile);

      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        originalname: 'avatar.jpg',
      } as Express.Multer.File;

      await service.uploadAvatar('user-uuid-1234', mockFile);

      expect(mockMediaService.deleteImage).toHaveBeenCalledWith(
        'https://example.com/old-avatar.jpg',
      );
    });

    it('should throw NotFoundException for non-existent profile', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await expect(
        service.uploadAvatar('non-existent', mockFile),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      mockProfileRepo.save.mockResolvedValue({
        ...mockProfile,
        avatarUrl: undefined,
      });

      await service.deleteAvatar('user-uuid-1234');

      expect(mockMediaService.deleteImage).toHaveBeenCalled();
      expect(mockProfileRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no avatar to delete', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        avatarUrl: null,
      });

      await expect(service.deleteAvatar('user-uuid-1234')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('uploadCover', () => {
    it('should upload cover and update profile', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        coverUrl: null,
      });
      mockProfileRepo.save.mockResolvedValue({
        ...mockProfile,
        coverUrl: 'https://example.com/new-cover.jpg',
      });

      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        originalname: 'cover.jpg',
      } as Express.Multer.File;

      const result = await service.uploadCover('user-uuid-1234', mockFile);

      expect(mockMediaService.uploadImage).toHaveBeenCalled();
      expect(result.coverUrl).toBeDefined();
    });
  });

  describe('deleteCover', () => {
    it('should delete cover', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        coverUrl: 'https://example.com/cover.jpg',
      });
      mockProfileRepo.save.mockResolvedValue({
        ...mockProfile,
        coverUrl: undefined,
      });

      await service.deleteCover('user-uuid-1234');

      expect(mockMediaService.deleteImage).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no cover to delete', async () => {
      mockProfileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        coverUrl: null,
      });

      await expect(service.deleteCover('user-uuid-1234')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
