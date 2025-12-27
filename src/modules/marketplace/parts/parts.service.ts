import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { Part, PartStatus } from './entities/part.entity.js';
import { PartImage } from './entities/part-image.entity.js';
import { CreatePartDto } from './dto/create-part.dto.js';
import { UpdatePartDto } from './dto/update-part.dto.js';
import {
  PartQueryDto,
  PartSearchDto,
  PartSortBy,
  CompatibilitySearchDto,
} from './dto/part-query.dto.js';
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
export class PartsService {
  private readonly logger = new Logger(PartsService.name);
  private readonly VIEWS_CACHE_KEY = 'part:views:';
  private readonly VIEWS_SYNC_INTERVAL = 60000; // 1 minute

  constructor(
    @InjectRepository(Part)
    private readonly partRepository: Repository<Part>,
    @InjectRepository(PartImage)
    private readonly imageRepository: Repository<PartImage>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
  ) {
    this.startViewsSync();
  }

  async create(
    userId: string,
    dto: CreatePartDto,
    files?: Express.Multer.File[],
  ): Promise<Part> {
    const part = this.partRepository.create({
      ...dto,
      userId,
      price: dto.price,
    });

    const savedPart = await this.partRepository.save(part);

    // Handle file uploads
    if (files && files.length > 0) {
      await this.uploadAndSaveImages(savedPart.id, userId, files);
    }

    // Handle pre-uploaded image URLs
    if (dto.imageUrls && dto.imageUrls.length > 0) {
      await this.saveImageUrls(savedPart.id, dto.imageUrls);
    }

    return this.findOne(savedPart.id);
  }

  async findAll(query: PartQueryDto): Promise<PaginatedResult<Part>> {
    const { page = 1, limit = 20 } = query;

    const queryBuilder = this.createPartQuery(query);

    const [parts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: parts,
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

  async findOne(id: string): Promise<Part> {
    const part = await this.partRepository.findOne({
      where: { id },
      relations: ['category', 'images', 'user'],
    });

    if (!part) {
      throw new NotFoundException('Part not found');
    }

    return part;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdatePartDto,
    files?: Express.Multer.File[],
  ): Promise<Part> {
    const part = await this.findOne(id);

    if (part.userId !== userId) {
      throw new ForbiddenException('You can only update your own parts');
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

    // Update part fields
    const { deleteImageIds, imageUrls, ...updateData } = dto;
    await this.partRepository.update(id, updateData);

    return this.findOne(id);
  }

  async delete(id: string, userId: string): Promise<void> {
    const part = await this.findOne(id);

    if (part.userId !== userId) {
      throw new ForbiddenException('You can only delete your own parts');
    }

    // Delete images from R2
    if (part.images && part.images.length > 0) {
      for (const image of part.images) {
        try {
          await this.mediaService.deleteImage(image.url);
        } catch (error) {
          this.logger.warn(`Failed to delete image: ${image.url}`, error);
        }
      }
    }

    await this.partRepository.softDelete(id);
  }

  async incrementViews(id: string): Promise<void> {
    await this.redisService.getClient().incr(`${this.VIEWS_CACHE_KEY}${id}`);
  }

  async markAsSold(id: string, userId: string): Promise<Part> {
    const part = await this.findOne(id);

    if (part.userId !== userId) {
      throw new ForbiddenException('You can only update your own parts');
    }

    await this.partRepository.update(id, { status: PartStatus.SOLD });

    return this.findOne(id);
  }

  async getByUser(
    userId: string,
    query: PartQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Part>> {
    const { page = 1, limit = 20 } = query;

    const queryBuilder = this.partRepository
      .createQueryBuilder('part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.images', 'images')
      .where('part.user_id = :userId', { userId })
      .orderBy('part.created_at', 'DESC');

    // If not own profile, only show active
    if (currentUserId !== userId) {
      queryBuilder.andWhere('part.status = :status', {
        status: PartStatus.ACTIVE,
      });
    }

    const [parts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: parts,
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

  async search(query: PartSearchDto): Promise<PaginatedResult<Part>> {
    const { page = 1, limit = 20, q } = query;

    const queryBuilder = this.createPartQuery(query);

    // Add text search
    if (q) {
      queryBuilder.andWhere(
        '(part.title ILIKE :search OR part.description ILIKE :search)',
        { search: `%${q}%` },
      );
    }

    const [parts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: parts,
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

  async searchByCompatibility(
    query: CompatibilitySearchDto,
  ): Promise<PaginatedResult<Part>> {
    const { model, page = 1, limit = 20 } = query;

    const queryBuilder = this.partRepository
      .createQueryBuilder('part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.images', 'images')
      .where('part.status = :status', { status: PartStatus.ACTIVE });

    // Search in JSON array using PostgreSQL containment operator
    if (model) {
      // Search for partial match in JSON array
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(part.compatibility) AS elem
          WHERE elem ILIKE :model
        )`,
        { model: `%${model}%` },
      );
    }

    queryBuilder.orderBy('part.created_at', 'DESC');

    const [parts, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: parts,
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

  async getPopular(limit: number = 10): Promise<Part[]> {
    return this.partRepository.find({
      where: { status: PartStatus.ACTIVE },
      relations: ['category', 'images'],
      order: { viewsCount: 'DESC' },
      take: limit,
    });
  }

  // Private helper methods

  private createPartQuery(query: PartQueryDto): SelectQueryBuilder<Part> {
    const {
      categoryId,
      minPrice,
      maxPrice,
      condition,
      brand,
      compatibleWith,
      location,
      status,
      sortBy,
    } = query;

    const queryBuilder = this.partRepository
      .createQueryBuilder('part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.images', 'images');

    // Apply filters
    if (categoryId) {
      queryBuilder.andWhere('part.category_id = :categoryId', { categoryId });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('part.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('part.price <= :maxPrice', { maxPrice });
    }

    if (condition) {
      queryBuilder.andWhere('part.condition = :condition', { condition });
    }

    if (brand) {
      queryBuilder.andWhere('part.brand ILIKE :brand', { brand: `%${brand}%` });
    }

    if (compatibleWith) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(part.compatibility) AS elem
          WHERE elem ILIKE :compatibleWith
        )`,
        { compatibleWith: `%${compatibleWith}%` },
      );
    }

    if (location) {
      queryBuilder.andWhere('part.location ILIKE :location', {
        location: `%${location}%`,
      });
    }

    // Status filter (default to active)
    queryBuilder.andWhere('part.status = :status', {
      status: status || PartStatus.ACTIVE,
    });

    // Apply sorting
    switch (sortBy) {
      case PartSortBy.OLDEST:
        queryBuilder.orderBy('part.created_at', 'ASC');
        break;
      case PartSortBy.PRICE_ASC:
        queryBuilder.orderBy('part.price', 'ASC');
        break;
      case PartSortBy.PRICE_DESC:
        queryBuilder.orderBy('part.price', 'DESC');
        break;
      case PartSortBy.VIEWS:
        queryBuilder.orderBy('part.views_count', 'DESC');
        break;
      case PartSortBy.NEWEST:
      default:
        queryBuilder.orderBy('part.created_at', 'DESC');
        break;
    }

    return queryBuilder;
  }

  private async uploadAndSaveImages(
    partId: string,
    userId: string,
    files: Express.Multer.File[],
  ): Promise<PartImage[]> {
    const results = await this.mediaService.uploadImages(
      files,
      'listings',
      userId,
    );

    const images = results.map((result, index) =>
      this.imageRepository.create({
        partId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        sortOrder: index,
      }),
    );

    return this.imageRepository.save(images);
  }

  private async saveImageUrls(
    partId: string,
    urls: string[],
  ): Promise<PartImage[]> {
    const existingCount = await this.imageRepository.count({
      where: { partId },
    });

    const images = urls.map((url, index) =>
      this.imageRepository.create({
        partId,
        url,
        sortOrder: existingCount + index,
      }),
    );

    return this.imageRepository.save(images);
  }

  private async deleteImages(imageIds: string[], userId: string): Promise<void> {
    const images = await this.imageRepository.find({
      where: { id: In(imageIds) },
      relations: ['part'],
    });

    for (const image of images) {
      // Verify ownership
      if (image.part?.userId !== userId) {
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
    const keys = await this.redisService.keys(`${this.VIEWS_CACHE_KEY}*`);

    if (keys.length === 0) return;

    const client = this.redisService.getClient();
    for (const key of keys) {
      const partId = key.replace(this.VIEWS_CACHE_KEY, '');
      const views = await client.getdel(key);

      if (views) {
        await this.partRepository.increment(
          { id: partId },
          'viewsCount',
          parseInt(views, 10),
        );
      }
    }
  }
}
