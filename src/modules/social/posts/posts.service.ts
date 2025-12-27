import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { MediaService } from '@modules/media/media.service.js';
import { Post, PostVisibility } from './entities/post.entity.js';
import { PostImage } from './entities/post-image.entity.js';
import { PostLike } from './entities/post-like.entity.js';
import { Hashtag } from './entities/hashtag.entity.js';
import { PostHashtag } from './entities/post-hashtag.entity.js';
import { PostMention } from './entities/post-mention.entity.js';
import { UserFollow } from '@database/entities/user-follow.entity.js';
import { UserBlock } from '@database/entities/user-block.entity.js';
import { UserProfile } from '@database/entities/user-profile.entity.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import {
  PostQueryDto,
  FeedQueryDto,
  PostSortBy,
  TrendingQueryDto,
} from './dto/post-query.dto.js';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface FeedResult<T> {
  data: T[];
  meta: {
    cursor?: string;
    hasMore: boolean;
  };
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  private readonly FEED_CACHE_KEY = 'feed:user:';
  private readonly HASHTAG_REGEX = /#(\w+)/g;
  private readonly MENTION_REGEX = /@(\w+)/g;

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostImage)
    private readonly imageRepository: Repository<PostImage>,
    @InjectRepository(PostLike)
    private readonly likeRepository: Repository<PostLike>,
    @InjectRepository(Hashtag)
    private readonly hashtagRepository: Repository<Hashtag>,
    @InjectRepository(PostHashtag)
    private readonly postHashtagRepository: Repository<PostHashtag>,
    @InjectRepository(PostMention)
    private readonly mentionRepository: Repository<PostMention>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(MediaService) private readonly mediaService: MediaService,
  ) {}

  async create(
    userId: string,
    dto: CreatePostDto,
    files?: Express.Multer.File[],
  ): Promise<Post> {
    const post = this.postRepository.create({
      userId,
      content: dto.content,
      visibility: dto.visibility,
      originalPostId: dto.originalPostId,
    });

    const savedPost = await this.postRepository.save(post);

    // Handle file uploads
    if (files && files.length > 0) {
      await this.uploadAndSaveImages(savedPost.id, userId, files);
    }

    // Handle pre-uploaded image URLs
    if (dto.imageUrls && dto.imageUrls.length > 0) {
      await this.saveImageUrls(savedPost.id, dto.imageUrls);
    }

    // Process hashtags
    await this.processHashtags(savedPost.id, dto.content);

    // Process mentions
    await this.processMentions(savedPost.id, dto.content);

    // If this is a repost, increment share count on original
    if (dto.originalPostId) {
      await this.postRepository.increment(
        { id: dto.originalPostId },
        'sharesCount',
        1,
      );
    }

    // Invalidate feed cache for followers
    await this.invalidateFeedCache(userId);

    return this.findOne(savedPost.id, userId);
  }

  async findOne(id: string, currentUserId?: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['user', 'images', 'originalPost', 'originalPost.user'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check visibility
    if (post.visibility === PostVisibility.PRIVATE && post.userId !== currentUserId) {
      throw new ForbiddenException('This post is private');
    }

    if (post.visibility === PostVisibility.FOLLOWERS && currentUserId) {
      const isFollower = await this.followRepository.findOne({
        where: { followerId: currentUserId, followingId: post.userId },
      });
      if (!isFollower && post.userId !== currentUserId) {
        throw new ForbiddenException('This post is for followers only');
      }
    }

    // Check if current user liked
    if (currentUserId) {
      const like = await this.likeRepository.findOne({
        where: { postId: id, userId: currentUserId },
      });
      post.isLiked = !!like;

      // Check if reposted
      const repost = await this.postRepository.findOne({
        where: { userId: currentUserId, originalPostId: id },
      });
      post.isReposted = !!repost;
    }

    return post;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdatePostDto,
    files?: Express.Multer.File[],
  ): Promise<Post> {
    const post = await this.findOne(id);

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    // Handle image deletions
    if (dto.deleteImageIds && dto.deleteImageIds.length > 0) {
      await this.deleteImages(dto.deleteImageIds, userId);
    }

    // Handle new uploads
    if (files && files.length > 0) {
      await this.uploadAndSaveImages(id, userId, files);
    }

    // Handle new pre-uploaded URLs
    if (dto.imageUrls && dto.imageUrls.length > 0) {
      await this.saveImageUrls(id, dto.imageUrls);
    }

    // Update content if provided
    if (dto.content) {
      // Remove old hashtags
      await this.removePostHashtags(id);
      // Process new hashtags
      await this.processHashtags(id, dto.content);
      // Remove old mentions
      await this.mentionRepository.delete({ postId: id });
      // Process new mentions
      await this.processMentions(id, dto.content);
    }

    // Update post
    await this.postRepository.update(id, {
      content: dto.content,
      visibility: dto.visibility,
      isEdited: true,
    });

    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const post = await this.findOne(id);

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Delete images from R2
    if (post.images && post.images.length > 0) {
      for (const image of post.images) {
        try {
          await this.mediaService.deleteImage(image.url);
        } catch (error) {
          this.logger.warn(`Failed to delete image: ${image.url}`, error);
        }
      }
    }

    // Decrement hashtag counts
    await this.removePostHashtags(id);

    // If repost, decrement original share count
    if (post.originalPostId) {
      await this.postRepository.decrement(
        { id: post.originalPostId },
        'sharesCount',
        1,
      );
    }

    await this.postRepository.softDelete(id);
  }

  async like(postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    // Verify post exists and user can access it
    await this.findOne(postId, userId);

    const existingLike = await this.likeRepository.findOne({
      where: { postId, userId },
    });

    if (existingLike) {
      // Unlike
      await this.likeRepository.delete(existingLike.id);
      await this.postRepository.decrement({ id: postId }, 'likesCount', 1);
      const updated = await this.postRepository.findOne({ where: { id: postId } });
      return { isLiked: false, likesCount: updated?.likesCount || 0 };
    }

    // Like
    const like = this.likeRepository.create({ postId, userId });
    await this.likeRepository.save(like);
    await this.postRepository.increment({ id: postId }, 'likesCount', 1);
    const updated = await this.postRepository.findOne({ where: { id: postId } });
    return { isLiked: true, likesCount: updated?.likesCount || 0 };
  }

  async share(postId: string, userId: string, content?: string): Promise<Post> {
    // Verify original post exists and user can access it
    await this.findOne(postId, userId);

    // Create repost
    const repost = this.postRepository.create({
      userId,
      content: content || '',
      originalPostId: postId,
      visibility: PostVisibility.PUBLIC,
    });

    const savedRepost = await this.postRepository.save(repost);

    // Increment share count
    await this.postRepository.increment({ id: postId }, 'sharesCount', 1);

    return this.findOne(savedRepost.id, userId);
  }

  async getFeed(
    userId: string,
    query: FeedQueryDto,
  ): Promise<FeedResult<Post>> {
    const { limit = 20, cursor } = query;

    // Get blocked users
    const blockedUsers = await this.getBlockedUserIds(userId);

    // Get following users
    const following = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });
    const followingIds = following.map((f) => f.followingId);

    // Build query
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.images', 'images')
      .leftJoinAndSelect('post.originalPost', 'originalPost')
      .leftJoinAndSelect('originalPost.user', 'originalUser')
      .where('post.deleted_at IS NULL');

    // Exclude blocked users
    if (blockedUsers.length > 0) {
      queryBuilder.andWhere('post.user_id NOT IN (:...blockedUsers)', { blockedUsers });
    }

    // Feed logic: following + popular public posts
    if (followingIds.length > 0) {
      queryBuilder.andWhere(
        `(
          post.user_id IN (:...followingIds) OR
          (post.visibility = :public AND post.likes_count >= :minLikes)
        )`,
        {
          followingIds,
          public: PostVisibility.PUBLIC,
          minLikes: 5,
        },
      );
    } else {
      // No following, show popular public posts
      queryBuilder.andWhere('post.visibility = :public', {
        public: PostVisibility.PUBLIC,
      });
    }

    // Cursor pagination
    if (cursor) {
      const cursorPost = await this.postRepository.findOne({
        where: { id: cursor },
      });
      if (cursorPost) {
        queryBuilder.andWhere('post.created_at < :cursorDate', {
          cursorDate: cursorPost.createdAt,
        });
      }
    }

    // Order by engagement score + recency
    queryBuilder
      .orderBy('post.created_at', 'DESC')
      .take(limit + 1);

    const posts = await queryBuilder.getMany();
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    // Mark liked posts
    if (posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const likes = await this.likeRepository.find({
        where: { userId, postId: In(postIds) },
      });
      const likedIds = new Set(likes.map((l) => l.postId));
      posts.forEach((p) => (p.isLiked = likedIds.has(p.id)));
    }

    return {
      data: posts,
      meta: {
        cursor: posts.length > 0 ? posts[posts.length - 1].id : undefined,
        hasMore,
      },
    };
  }

  async getUserPosts(
    userId: string,
    query: PostQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Post>> {
    const { page = 1, limit = 20, sortBy } = query;

    // Check if blocked
    if (currentUserId) {
      const blocked = await this.blockRepository.findOne({
        where: [
          { blockerId: userId, blockedId: currentUserId },
          { blockerId: currentUserId, blockedId: userId },
        ],
      });
      if (blocked) {
        return {
          data: [],
          meta: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        };
      }
    }

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.images', 'images')
      .leftJoinAndSelect('post.originalPost', 'originalPost')
      .where('post.user_id = :userId', { userId })
      .andWhere('post.deleted_at IS NULL');

    // Visibility filter
    if (currentUserId !== userId) {
      const isFollowing = await this.followRepository.findOne({
        where: { followerId: currentUserId, followingId: userId },
      });
      if (isFollowing) {
        queryBuilder.andWhere('post.visibility IN (:...visibilities)', {
          visibilities: [PostVisibility.PUBLIC, PostVisibility.FOLLOWERS],
        });
      } else {
        queryBuilder.andWhere('post.visibility = :visibility', {
          visibility: PostVisibility.PUBLIC,
        });
      }
    }

    // Sorting
    switch (sortBy) {
      case PostSortBy.OLDEST:
        queryBuilder.orderBy('post.created_at', 'ASC');
        break;
      case PostSortBy.POPULAR:
        queryBuilder.orderBy('post.likes_count', 'DESC');
        break;
      default:
        queryBuilder.orderBy('post.created_at', 'DESC');
    }

    const [posts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Mark liked
    if (currentUserId && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const likes = await this.likeRepository.find({
        where: { userId: currentUserId, postId: In(postIds) },
      });
      const likedIds = new Set(likes.map((l) => l.postId));
      posts.forEach((p) => (p.isLiked = likedIds.has(p.id)));
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: posts,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getByHashtag(
    tag: string,
    query: PostQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Post>> {
    const { page = 1, limit = 20 } = query;

    const normalizedTag = tag.toLowerCase().replace(/^#/, '');

    const hashtag = await this.hashtagRepository.findOne({
      where: { name: normalizedTag },
    });

    if (!hashtag) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const blockedUsers = currentUserId ? await this.getBlockedUserIds(currentUserId) : [];

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .innerJoin('post_hashtags', 'ph', 'ph.post_id = post.id')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.images', 'images')
      .where('ph.hashtag_id = :hashtagId', { hashtagId: hashtag.id })
      .andWhere('post.visibility = :visibility', { visibility: PostVisibility.PUBLIC })
      .andWhere('post.deleted_at IS NULL');

    if (blockedUsers.length > 0) {
      queryBuilder.andWhere('post.user_id NOT IN (:...blockedUsers)', { blockedUsers });
    }

    queryBuilder.orderBy('post.created_at', 'DESC');

    const [posts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (currentUserId && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const likes = await this.likeRepository.find({
        where: { userId: currentUserId, postId: In(postIds) },
      });
      const likedIds = new Set(likes.map((l) => l.postId));
      posts.forEach((p) => (p.isLiked = likedIds.has(p.id)));
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: posts,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getTrendingHashtags(query: TrendingQueryDto): Promise<Hashtag[]> {
    const { limit = 10, hours = 24 } = query;

    const since = new Date();
    since.setHours(since.getHours() - hours);

    // Get hashtags with most posts in the time window
    const trending = await this.hashtagRepository
      .createQueryBuilder('hashtag')
      .innerJoin('post_hashtags', 'ph', 'ph.hashtag_id = hashtag.id')
      .innerJoin('posts', 'post', 'post.id = ph.post_id')
      .where('ph.created_at >= :since', { since })
      .andWhere('post.deleted_at IS NULL')
      .groupBy('hashtag.id')
      .orderBy('COUNT(ph.post_id)', 'DESC')
      .limit(limit)
      .getMany();

    return trending;
  }

  async getTrendingPosts(
    query: PostQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Post>> {
    const { page = 1, limit = 20 } = query;

    const since = new Date();
    since.setHours(since.getHours() - 24);

    const blockedUsers = currentUserId ? await this.getBlockedUserIds(currentUserId) : [];

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.images', 'images')
      .where('post.visibility = :visibility', { visibility: PostVisibility.PUBLIC })
      .andWhere('post.created_at >= :since', { since })
      .andWhere('post.deleted_at IS NULL');

    if (blockedUsers.length > 0) {
      queryBuilder.andWhere('post.user_id NOT IN (:...blockedUsers)', { blockedUsers });
    }

    // Score: likes + comments*2 + shares*3
    queryBuilder
      .orderBy('(post.likes_count + post.comments_count * 2 + post.shares_count * 3)', 'DESC')
      .addOrderBy('post.created_at', 'DESC');

    const [posts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (currentUserId && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const likes = await this.likeRepository.find({
        where: { userId: currentUserId, postId: In(postIds) },
      });
      const likedIds = new Set(likes.map((l) => l.postId));
      posts.forEach((p) => (p.isLiked = likedIds.has(p.id)));
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: posts,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Private helpers

  private extractHashtags(content: string): string[] {
    const matches = content.match(this.HASHTAG_REGEX);
    if (!matches) return [];
    return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(this.MENTION_REGEX);
    if (!matches) return [];
    return [...new Set(matches.map((mention) => mention.slice(1).toLowerCase()))];
  }

  private async processHashtags(postId: string, content: string): Promise<void> {
    const hashtags = this.extractHashtags(content);

    for (const tag of hashtags) {
      let hashtag = await this.hashtagRepository.findOne({
        where: { name: tag },
      });

      if (!hashtag) {
        hashtag = this.hashtagRepository.create({ name: tag, postsCount: 0 });
        hashtag = await this.hashtagRepository.save(hashtag);
      }

      // Create relation
      const postHashtag = this.postHashtagRepository.create({
        postId,
        hashtagId: hashtag.id,
      });
      await this.postHashtagRepository.save(postHashtag);

      // Increment count
      await this.hashtagRepository.increment({ id: hashtag.id }, 'postsCount', 1);
    }
  }

  private async removePostHashtags(postId: string): Promise<void> {
    const postHashtags = await this.postHashtagRepository.find({
      where: { postId },
    });

    for (const ph of postHashtags) {
      await this.hashtagRepository.decrement({ id: ph.hashtagId }, 'postsCount', 1);
    }

    await this.postHashtagRepository.delete({ postId });
  }

  private async processMentions(postId: string, content: string): Promise<void> {
    const usernames = this.extractMentions(content);

    for (const username of usernames) {
      const profile = await this.profileRepository.findOne({
        where: { username: username.toLowerCase() },
      });

      if (profile) {
        const mention = this.mentionRepository.create({
          postId,
          mentionedUserId: profile.userId,
        });
        await this.mentionRepository.save(mention);
        // TODO: Trigger notification in Phase 4
      }
    }
  }

  private async uploadAndSaveImages(
    postId: string,
    userId: string,
    files: Express.Multer.File[],
  ): Promise<PostImage[]> {
    const results = await this.mediaService.uploadImages(files, 'posts', userId);

    const images = results.map((result, index) =>
      this.imageRepository.create({
        postId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        width: result.width,
        height: result.height,
        sortOrder: index,
      }),
    );

    return this.imageRepository.save(images);
  }

  private async saveImageUrls(postId: string, urls: string[]): Promise<PostImage[]> {
    const existingCount = await this.imageRepository.count({
      where: { postId },
    });

    const images = urls.map((url, index) =>
      this.imageRepository.create({
        postId,
        url,
        sortOrder: existingCount + index,
      }),
    );

    return this.imageRepository.save(images);
  }

  private async deleteImages(imageIds: string[], userId: string): Promise<void> {
    const images = await this.imageRepository.find({
      where: { id: In(imageIds) },
      relations: ['post'],
    });

    for (const image of images) {
      if (image.post?.userId !== userId) continue;

      try {
        await this.mediaService.deleteImage(image.url);
        await this.imageRepository.delete(image.id);
      } catch (error) {
        this.logger.warn(`Failed to delete image ${image.id}`, error);
      }
    }
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });

    const blockedIds = new Set<string>();
    blocks.forEach((b) => {
      if (b.blockerId === userId) blockedIds.add(b.blockedId);
      else blockedIds.add(b.blockerId);
    });

    return Array.from(blockedIds);
  }

  private async invalidateFeedCache(userId: string): Promise<void> {
    // Invalidate for all followers
    const followers = await this.followRepository.find({
      where: { followingId: userId },
      select: ['followerId'],
    });

    for (const follower of followers) {
      await this.redisService.del(`${this.FEED_CACHE_KEY}${follower.followerId}`);
    }
  }
}
