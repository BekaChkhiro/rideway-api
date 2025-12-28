import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { Listing, ListingStatus } from './entities/listing.entity.js';
import { ListingImage } from './entities/listing-image.entity.js';
import { ListingFavorite } from './entities/listing-favorite.entity.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import {
  ListingQueryDto,
  ListingSearchDto,
  ListingSortBy,
} from './dto/listing-query.dto.js';
import { MediaService } from '@modules/media/media.service.js';

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

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);
  private readonly VIEWS_CACHE_KEY = 'listing:views:';
  private readonly VIEWS_SYNC_INTERVAL = 60000; // 1 minute
  private readonly POPULAR_CACHE_KEY = 'listings:popular';
  private readonly POPULAR_CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    @InjectRepository(ListingImage)
    private readonly imageRepository: Repository<ListingImage>,
    @InjectRepository(ListingFavorite)
    private readonly favoriteRepository: Repository<ListingFavorite>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
  ) {
    // Start periodic view count sync
    this.startViewsSync();
  }

  async create(
    userId: string,
    dto: CreateListingDto,
    files?: Express.Multer.File[],
  ): Promise<Listing> {
    const listing = this.listingRepository.create({
      ...dto,
      userId,
      price: dto.price,
    });

    const savedListing = await this.listingRepository.save(listing);

    // Handle file uploads
    if (files && files.length > 0) {
      await this.uploadAndSaveImages(savedListing.id, userId, files);
    }

    // Handle pre-uploaded image URLs
    if (dto.imageUrls && dto.imageUrls.length > 0) {
      await this.saveImageUrls(savedListing.id, dto.imageUrls);
    }

    return this.findOne(savedListing.id);
  }

  async findAll(
    query: ListingQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Listing>> {
    const { page = 1, limit = 20 } = query;

    const queryBuilder = this.createListingQuery(query);

    const [listings, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Check favorites for current user
    if (currentUserId && listings.length > 0) {
      await this.markFavorites(listings, currentUserId);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: listings,
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

  async findOne(id: string, currentUserId?: string): Promise<Listing> {
    const listing = await this.listingRepository.findOne({
      where: { id },
      relations: ['category', 'images', 'user'],
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if current user favorited
    if (currentUserId) {
      const favorite = await this.favoriteRepository.findOne({
        where: { listingId: id, userId: currentUserId },
      });
      listing.isFavorited = !!favorite;
    }

    return listing;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateListingDto,
    files?: Express.Multer.File[],
  ): Promise<Listing> {
    const listing = await this.findOne(id);

    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    // Handle image deletions
    if (dto.deleteImageIds && dto.deleteImageIds.length > 0) {
      await this.deleteImages(dto.deleteImageIds, userId);
    }

    // Handle new file uploads
    if (files && files.length > 0) {
      await this.uploadAndSaveImages(id, userId, files);
    }

    // Handle new pre-uploaded URLs
    if (dto.imageUrls && dto.imageUrls.length > 0) {
      await this.saveImageUrls(id, dto.imageUrls);
    }

    // Update listing fields
    const {
      deleteImageIds: _deleteImageIds,
      imageUrls: _imageUrls,
      ...updateData
    } = dto;
    await this.listingRepository.update(id, updateData);

    return this.findOne(id);
  }

  async delete(id: string, userId: string): Promise<void> {
    const listing = await this.findOne(id);

    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only delete your own listings');
    }

    // Delete images from R2
    if (listing.images && listing.images.length > 0) {
      for (const image of listing.images) {
        try {
          await this.mediaService.deleteImage(image.url);
        } catch (error) {
          this.logger.warn(`Failed to delete image: ${image.url}`, error);
        }
      }
    }

    await this.listingRepository.softDelete(id);
  }

  async incrementViews(id: string): Promise<void> {
    // Increment in Redis for batching
    await this.redisService.getClient().incr(`${this.VIEWS_CACHE_KEY}${id}`);
  }

  async markAsSold(id: string, userId: string): Promise<Listing> {
    const listing = await this.findOne(id);

    if (listing.userId !== userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    await this.listingRepository.update(id, { status: ListingStatus.SOLD });

    return this.findOne(id);
  }

  async getByUser(
    userId: string,
    query: ListingQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Listing>> {
    const { page = 1, limit = 20 } = query;

    const queryBuilder = this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.images', 'images')
      .where('listing.user_id = :userId', { userId })
      .orderBy('listing.created_at', 'DESC');

    // If not own profile, only show active
    if (currentUserId !== userId) {
      queryBuilder.andWhere('listing.status = :status', {
        status: ListingStatus.ACTIVE,
      });
    }

    const [listings, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (currentUserId && listings.length > 0) {
      await this.markFavorites(listings, currentUserId);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: listings,
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

  async search(
    query: ListingSearchDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Listing>> {
    const { page = 1, limit = 20, q } = query;

    const queryBuilder = this.createListingQuery(query);

    // Add text search
    if (q) {
      queryBuilder.andWhere(
        '(listing.title ILIKE :search OR listing.description ILIKE :search)',
        { search: `%${q}%` },
      );
    }

    const [listings, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (currentUserId && listings.length > 0) {
      await this.markFavorites(listings, currentUserId);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: listings,
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

  async getPopular(limit: number = 10): Promise<Listing[]> {
    // Try cache first
    const cached = await this.redisService.get(this.POPULAR_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const listings = await this.listingRepository.find({
      where: { status: ListingStatus.ACTIVE },
      relations: ['category', 'images'],
      order: { viewsCount: 'DESC' },
      take: limit,
    });

    // Cache for 5 minutes
    await this.redisService.set(
      this.POPULAR_CACHE_KEY,
      JSON.stringify(listings),
      this.POPULAR_CACHE_TTL,
    );

    return listings;
  }

  async getRelated(id: string, limit: number = 6): Promise<Listing[]> {
    const listing = await this.findOne(id);

    const queryBuilder = this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'images')
      .where('listing.id != :id', { id })
      .andWhere('listing.status = :status', { status: ListingStatus.ACTIVE });

    // Same category
    if (listing.categoryId) {
      queryBuilder.andWhere('listing.category_id = :categoryId', {
        categoryId: listing.categoryId,
      });
    }

    // Similar price range (±30%)
    const minPrice = listing.price * 0.7;
    const maxPrice = listing.price * 1.3;
    queryBuilder.andWhere('listing.price BETWEEN :minPrice AND :maxPrice', {
      minPrice,
      maxPrice,
    });

    queryBuilder.orderBy('listing.views_count', 'DESC').take(limit);

    return queryBuilder.getMany();
  }

  // Private helper methods

  private createListingQuery(
    query: ListingQueryDto,
  ): SelectQueryBuilder<Listing> {
    const {
      categoryId,
      minPrice,
      maxPrice,
      condition,
      location,
      lat,
      lng,
      radius,
      status,
      sortBy,
    } = query;

    const queryBuilder = this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.images', 'images');

    // Apply filters
    if (categoryId) {
      queryBuilder.andWhere('listing.category_id = :categoryId', {
        categoryId,
      });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('listing.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('listing.price <= :maxPrice', { maxPrice });
    }

    if (condition) {
      queryBuilder.andWhere('listing.condition = :condition', { condition });
    }

    if (location) {
      queryBuilder.andWhere('listing.location ILIKE :location', {
        location: `%${location}%`,
      });
    }

    // Radius search with Haversine formula
    if (lat && lng && radius) {
      queryBuilder.andWhere(
        `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(listing.latitude)) *
            cos(radians(listing.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(listing.latitude))
          )
        ) <= :radius`,
        { lat, lng, radius },
      );
    }

    // Status filter (default to active)
    queryBuilder.andWhere('listing.status = :status', {
      status: status || ListingStatus.ACTIVE,
    });

    // Apply sorting
    switch (sortBy) {
      case ListingSortBy.OLDEST:
        queryBuilder.orderBy('listing.created_at', 'ASC');
        break;
      case ListingSortBy.PRICE_ASC:
        queryBuilder.orderBy('listing.price', 'ASC');
        break;
      case ListingSortBy.PRICE_DESC:
        queryBuilder.orderBy('listing.price', 'DESC');
        break;
      case ListingSortBy.VIEWS:
        queryBuilder.orderBy('listing.views_count', 'DESC');
        break;
      case ListingSortBy.NEWEST:
      default:
        // Featured first, then by date
        queryBuilder
          .orderBy('listing.is_featured', 'DESC')
          .addOrderBy('listing.created_at', 'DESC');
        break;
    }

    return queryBuilder;
  }

  private async uploadAndSaveImages(
    listingId: string,
    userId: string,
    files: Express.Multer.File[],
  ): Promise<ListingImage[]> {
    const results = await this.mediaService.uploadImages(
      files,
      'listings',
      userId,
    );

    const images = results.map((result, index) =>
      this.imageRepository.create({
        listingId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        sortOrder: index,
      }),
    );

    return this.imageRepository.save(images);
  }

  private async saveImageUrls(
    listingId: string,
    urls: string[],
  ): Promise<ListingImage[]> {
    const existingCount = await this.imageRepository.count({
      where: { listingId },
    });

    const images = urls.map((url, index) =>
      this.imageRepository.create({
        listingId,
        url,
        sortOrder: existingCount + index,
      }),
    );

    return this.imageRepository.save(images);
  }

  private async deleteImages(
    imageIds: string[],
    userId: string,
  ): Promise<void> {
    const images = await this.imageRepository.find({
      where: { id: In(imageIds) },
      relations: ['listing'],
    });

    for (const image of images) {
      // Verify ownership
      if (image.listing?.userId !== userId) {
        continue;
      }

      try {
        await this.mediaService.deleteImage(image.url);
        await this.imageRepository.delete(image.id);
      } catch (error) {
        this.logger.warn(`Failed to delete image ${image.id}`, error);
      }
    }
  }

  private async markFavorites(
    listings: Listing[],
    userId: string,
  ): Promise<void> {
    const listingIds = listings.map((l) => l.id);
    const favorites = await this.favoriteRepository.find({
      where: {
        userId,
        listingId: In(listingIds),
      },
    });

    const favoriteSet = new Set(favorites.map((f) => f.listingId));

    for (const listing of listings) {
      listing.isFavorited = favoriteSet.has(listing.id);
    }
  }

  private startViewsSync(): void {
    setInterval(async () => {
      try {
        await this.syncViewCounts();
      } catch (error) {
        this.logger.error('Failed to sync view counts', error);
      }
    }, this.VIEWS_SYNC_INTERVAL);
  }

  private async syncViewCounts(): Promise<void> {
    if (!this.redisService) return;

    const keys = await this.redisService.keys(`${this.VIEWS_CACHE_KEY}*`);

    if (keys.length === 0) return;

    const client = this.redisService.getClient();
    for (const key of keys) {
      const listingId = key.replace(this.VIEWS_CACHE_KEY, '');
      const views = await client.getdel(key);

      if (views) {
        await this.listingRepository.increment(
          { id: listingId },
          'viewsCount',
          parseInt(views, 10),
        );
      }
    }

    // Invalidate popular cache after view sync
    await this.redisService.del(this.POPULAR_CACHE_KEY);
  }
}
