import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserProfile, UserFollow, UserBlock } from '@database/index.js';
import {
  UpdateProfileDto,
  PaginationQueryDto,
  UserSearchQueryDto,
} from './dto/index.js';
import {
  UserProfileResponse,
  UserListItemResponse,
  PaginatedUsersResponse,
} from './interfaces/user-response.interface.js';
import { MediaService } from '@modules/media/media.service.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
  ) {}

  async getUserById(
    userId: string,
    currentUserId?: string,
  ): Promise<UserProfileResponse> {
    if (currentUserId) {
      const isBlocked = await this.isUserBlocked(userId, currentUserId);
      if (isBlocked) {
        throw new NotFoundException('User not found');
      }
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user || !user.profile) {
      throw new NotFoundException('User not found');
    }

    const counts = await this.getUserCounts(userId);
    const isFollowing = currentUserId
      ? await this.isFollowing(currentUserId, userId)
      : undefined;

    return this.mapToProfileResponse(user, counts, isFollowing);
  }

  async getUserByUsername(
    username: string,
    currentUserId?: string,
  ): Promise<UserProfileResponse> {
    const profile = await this.profileRepository.findOne({
      where: { username },
      relations: ['user'],
    });

    if (!profile || !profile.user || !profile.user.isActive) {
      throw new NotFoundException('User not found');
    }

    if (currentUserId) {
      const isBlocked = await this.isUserBlocked(profile.userId, currentUserId);
      if (isBlocked) {
        throw new NotFoundException('User not found');
      }
    }

    const counts = await this.getUserCounts(profile.userId);
    const isFollowing = currentUserId
      ? await this.isFollowing(currentUserId, profile.userId)
      : undefined;

    return this.mapToProfileResponse(profile.user, counts, isFollowing);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (dto.username && dto.username !== profile.username) {
      const existingUsername = await this.profileRepository.findOne({
        where: { username: dto.username },
      });
      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }
    }

    Object.assign(profile, {
      ...dto,
      dateOfBirth: dto.dateOfBirth
        ? new Date(dto.dateOfBirth)
        : profile.dateOfBirth,
    });

    await this.profileRepository.save(profile);

    const counts = await this.getUserCounts(userId);
    return this.mapToProfileResponse(profile.user, counts);
  }

  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: followingId, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const isBlocked = await this.isUserBlocked(followingId, followerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot follow this user');
    }

    const existingFollow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    if (existingFollow) {
      throw new ConflictException('You are already following this user');
    }

    const follow = this.followRepository.create({
      followerId,
      followingId,
    });

    await this.followRepository.save(follow);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    if (!follow) {
      throw new NotFoundException('You are not following this user');
    }

    await this.followRepository.remove(follow);
  }

  async getFollowers(
    userId: string,
    query: PaginationQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedUsersResponse> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    let queryBuilder = this.followRepository
      .createQueryBuilder('follow')
      .innerJoin('follow.follower', 'user')
      .innerJoin('user.profile', 'profile')
      .where('follow.followingId = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true });

    if (currentUserId) {
      const blockedIds = await this.getBlockedUserIds(currentUserId);
      if (blockedIds.length > 0) {
        queryBuilder = queryBuilder.andWhere(
          'follow.followerId NOT IN (:...blockedIds)',
          { blockedIds },
        );
      }
    }

    const [follows, total] = await queryBuilder
      .select([
        'follow.followerId',
        'user.id',
        'profile.username',
        'profile.fullName',
        'profile.avatarUrl',
        'profile.bio',
      ])
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const followingSet = currentUserId
      ? await this.getFollowingSet(currentUserId)
      : new Set<string>();

    const items: UserListItemResponse[] = follows.map((follow) => ({
      id: follow.follower.id,
      username: follow.follower.profile?.username ?? '',
      fullName: follow.follower.profile?.fullName,
      avatarUrl: follow.follower.profile?.avatarUrl,
      bio: follow.follower.profile?.bio,
      isFollowing: followingSet.has(follow.followerId),
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(
    userId: string,
    query: PaginationQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedUsersResponse> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    let queryBuilder = this.followRepository
      .createQueryBuilder('follow')
      .innerJoin('follow.following', 'user')
      .innerJoin('user.profile', 'profile')
      .where('follow.followerId = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true });

    if (currentUserId) {
      const blockedIds = await this.getBlockedUserIds(currentUserId);
      if (blockedIds.length > 0) {
        queryBuilder = queryBuilder.andWhere(
          'follow.followingId NOT IN (:...blockedIds)',
          { blockedIds },
        );
      }
    }

    const [follows, total] = await queryBuilder
      .select([
        'follow.followingId',
        'user.id',
        'profile.username',
        'profile.fullName',
        'profile.avatarUrl',
        'profile.bio',
      ])
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const followingSet = currentUserId
      ? await this.getFollowingSet(currentUserId)
      : new Set<string>();

    const items: UserListItemResponse[] = follows.map((follow) => ({
      id: follow.following.id,
      username: follow.following.profile?.username ?? '',
      fullName: follow.following.profile?.fullName,
      avatarUrl: follow.following.profile?.avatarUrl,
      bio: follow.following.profile?.bio,
      isFollowing: followingSet.has(follow.followingId),
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: blockedId, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existingBlock = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existingBlock) {
      throw new ConflictException('User is already blocked');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserFollow, {
        followerId: blockerId,
        followingId: blockedId,
      });
      await manager.delete(UserFollow, {
        followerId: blockedId,
        followingId: blockerId,
      });

      const block = manager.create(UserBlock, {
        blockerId,
        blockedId,
      });
      await manager.save(block);
    });
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException('User is not blocked');
    }

    await this.blockRepository.remove(block);
  }

  async searchUsers(
    query: UserSearchQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedUsersResponse> {
    const { page = 1, limit = 20, q } = query;
    const skip = (page - 1) * limit;

    let queryBuilder = this.profileRepository
      .createQueryBuilder('profile')
      .innerJoin('profile.user', 'user')
      .where('user.isActive = :isActive', { isActive: true });

    if (q) {
      queryBuilder = queryBuilder.andWhere(
        '(LOWER(profile.username) LIKE LOWER(:query) OR LOWER(profile.fullName) LIKE LOWER(:query))',
        { query: `%${q}%` },
      );
    }

    if (currentUserId) {
      const blockedIds = await this.getBlockedUserIds(currentUserId);
      if (blockedIds.length > 0) {
        queryBuilder = queryBuilder.andWhere(
          'profile.userId NOT IN (:...blockedIds)',
          { blockedIds },
        );
      }
    }

    const [profiles, total] = await queryBuilder
      .select([
        'profile.userId',
        'profile.username',
        'profile.fullName',
        'profile.avatarUrl',
        'profile.bio',
      ])
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const followingSet = currentUserId
      ? await this.getFollowingSet(currentUserId)
      : new Set<string>();

    const items: UserListItemResponse[] = profiles.map((profile) => ({
      id: profile.userId,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      isFollowing: followingSet.has(profile.userId),
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getUserCounts(userId: string): Promise<{
    followersCount: number;
    followingCount: number;
    postsCount: number;
  }> {
    const [followersCount, followingCount] = await Promise.all([
      this.followRepository.count({ where: { followingId: userId } }),
      this.followRepository.count({ where: { followerId: userId } }),
    ]);

    return {
      followersCount,
      followingCount,
      postsCount: 0,
    };
  }

  private async isFollowing(
    followerId: string,
    followingId: string,
  ): Promise<boolean> {
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });
    return !!follow;
  }

  private async isUserBlocked(
    userId: string,
    currentUserId: string,
  ): Promise<boolean> {
    const block = await this.blockRepository.findOne({
      where: [
        { blockerId: currentUserId, blockedId: userId },
        { blockerId: userId, blockedId: currentUserId },
      ],
    });
    return !!block;
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });

    const blockedIds = new Set<string>();
    blocks.forEach((block) => {
      if (block.blockerId === userId) {
        blockedIds.add(block.blockedId);
      } else {
        blockedIds.add(block.blockerId);
      }
    });

    return Array.from(blockedIds);
  }

  private async getFollowingSet(userId: string): Promise<Set<string>> {
    const follows = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });
    return new Set(follows.map((f) => f.followingId));
  }

  private mapToProfileResponse(
    user: User,
    counts: {
      followersCount: number;
      followingCount: number;
      postsCount: number;
    },
    isFollowing?: boolean,
  ): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.profile?.username ?? '',
      fullName: user.profile?.fullName,
      bio: user.profile?.bio,
      avatarUrl: user.profile?.avatarUrl,
      coverUrl: user.profile?.coverUrl,
      location: user.profile?.location,
      website: user.profile?.website,
      dateOfBirth: user.profile?.dateOfBirth,
      gender: user.profile?.gender,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
      postsCount: counts.postsCount,
      isFollowing,
      createdAt: user.createdAt,
    };
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Delete old avatar if exists
    if (profile.avatarUrl) {
      try {
        await this.mediaService.deleteImage(profile.avatarUrl);
      } catch (error) {
        this.logger.warn(`Failed to delete old avatar: ${error}`);
      }
    }

    // Upload new avatar
    const result = await this.mediaService.uploadImage(file, 'avatars', userId);

    // Update profile
    profile.avatarUrl = result.url;
    await this.profileRepository.save(profile);

    this.logger.log(`Avatar uploaded for user ${userId}`);

    return { avatarUrl: result.url };
  }

  async deleteAvatar(userId: string): Promise<void> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (!profile.avatarUrl) {
      throw new BadRequestException('No avatar to delete');
    }

    // Delete from R2
    try {
      await this.mediaService.deleteImage(profile.avatarUrl);
    } catch (error) {
      this.logger.warn(`Failed to delete avatar from storage: ${error}`);
    }

    // Update profile
    profile.avatarUrl = undefined;
    await this.profileRepository.save(profile);

    this.logger.log(`Avatar deleted for user ${userId}`);
  }

  async uploadCover(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ coverUrl: string }> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Delete old cover if exists
    if (profile.coverUrl) {
      try {
        await this.mediaService.deleteImage(profile.coverUrl);
      } catch (error) {
        this.logger.warn(`Failed to delete old cover: ${error}`);
      }
    }

    // Upload new cover
    const result = await this.mediaService.uploadImage(file, 'covers', userId);

    // Update profile
    profile.coverUrl = result.url;
    await this.profileRepository.save(profile);

    this.logger.log(`Cover uploaded for user ${userId}`);

    return { coverUrl: result.url };
  }

  async deleteCover(userId: string): Promise<void> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (!profile.coverUrl) {
      throw new BadRequestException('No cover to delete');
    }

    // Delete from R2
    try {
      await this.mediaService.deleteImage(profile.coverUrl);
    } catch (error) {
      this.logger.warn(`Failed to delete cover from storage: ${error}`);
    }

    // Update profile
    profile.coverUrl = undefined;
    await this.profileRepository.save(profile);

    this.logger.log(`Cover deleted for user ${userId}`);
  }
}
