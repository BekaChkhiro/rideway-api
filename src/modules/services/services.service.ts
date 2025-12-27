import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service, ServiceStatus } from './entities/service.entity.js';
import { ServiceImage } from './entities/service-image.entity.js';
import { ServiceReview } from './entities/service-review.entity.js';
import { ServiceCategoriesService } from './service-categories.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServiceQueryDto, ServiceSortBy } from './dto/service-query.dto.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';

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
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(ServiceImage)
    private readonly imageRepository: Repository<ServiceImage>,
    @InjectRepository(ServiceReview)
    private readonly reviewRepository: Repository<ServiceReview>,
    private readonly categoriesService: ServiceCategoriesService,
  ) {}

  // Service methods
  async create(userId: string, dto: CreateServiceDto): Promise<Service> {
    // Verify category exists
    await this.categoriesService.findOne(dto.categoryId);

    const { imageUrls, ...serviceData } = dto;

    const service = this.serviceRepository.create({
      ...serviceData,
      userId,
    });

    const savedService = await this.serviceRepository.save(service);

    // Create images if provided
    if (imageUrls && imageUrls.length > 0) {
      const images = imageUrls.map((url, index) =>
        this.imageRepository.create({
          serviceId: savedService.id,
          url,
          isPrimary: index === 0,
          sortOrder: index,
        }),
      );
      await this.imageRepository.save(images);
    }

    return this.findOne(savedService.id, userId);
  }

  async findAll(
    query: ServiceQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResult<Service>> {
    const {
      page = 1,
      limit = 20,
      categoryId,
      city,
      latitude,
      longitude,
      radius,
      search,
      sortBy,
      verified,
    } = query;

    const queryBuilder = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.user', 'user')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('service.images', 'images')
      .where('service.deleted_at IS NULL')
      .andWhere('service.status = :status', { status: ServiceStatus.ACTIVE });

    if (categoryId) {
      queryBuilder.andWhere('service.category_id = :categoryId', { categoryId });
    }

    if (city) {
      queryBuilder.andWhere('LOWER(service.city) LIKE LOWER(:city)', {
        city: `%${city}%`,
      });
    }

    if (verified) {
      queryBuilder.andWhere('service.is_verified = true');
    }

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(service.name) LIKE LOWER(:search) OR LOWER(service.description) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Location-based filtering
    if (latitude && longitude && radius) {
      // Haversine formula for distance in km
      queryBuilder.andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(service.latitude)) * cos(radians(service.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(service.latitude)))) <= :radius`,
        { lat: latitude, lng: longitude, radius },
      );
    }

    // Sorting
    switch (sortBy) {
      case ServiceSortBy.REVIEWS:
        queryBuilder.orderBy('service.reviews_count', 'DESC');
        break;
      case ServiceSortBy.NEWEST:
        queryBuilder.orderBy('service.created_at', 'DESC');
        break;
      case ServiceSortBy.DISTANCE:
        if (latitude && longitude) {
          queryBuilder
            .addSelect(
              `(6371 * acos(cos(radians(:lat)) * cos(radians(service.latitude)) * cos(radians(service.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(service.latitude))))`,
              'distance',
            )
            .orderBy('distance', 'ASC');
        } else {
          queryBuilder.orderBy('service.rating_avg', 'DESC');
        }
        break;
      case ServiceSortBy.RATING:
      default:
        queryBuilder.orderBy('service.rating_avg', 'DESC');
        break;
    }

    queryBuilder.addOrderBy('service.reviews_count', 'DESC');

    const [services, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Mark ownership
    if (currentUserId) {
      services.forEach((service) => {
        service.isOwner = service.userId === currentUserId;
      });
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: services,
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

  async findOne(id: string, currentUserId?: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id },
      relations: ['user', 'category', 'images'],
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (currentUserId) {
      service.isOwner = service.userId === currentUserId;
    }

    return service;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateServiceDto,
  ): Promise<Service> {
    const service = await this.findOne(id);

    if (service.userId !== userId) {
      throw new ForbiddenException('You can only edit your own services');
    }

    const { imageUrls, ...updateData } = dto;

    await this.serviceRepository.update(id, updateData);

    // Update images if provided
    if (imageUrls !== undefined) {
      // Delete existing images
      await this.imageRepository.delete({ serviceId: id });

      // Create new images
      if (imageUrls.length > 0) {
        const images = imageUrls.map((url, index) =>
          this.imageRepository.create({
            serviceId: id,
            url,
            isPrimary: index === 0,
            sortOrder: index,
          }),
        );
        await this.imageRepository.save(images);
      }
    }

    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const service = await this.findOne(id);

    if (service.userId !== userId) {
      throw new ForbiddenException('You can only delete your own services');
    }

    await this.serviceRepository.softDelete(id);
  }

  async verify(id: string): Promise<Service> {
    const service = await this.findOne(id);
    await this.serviceRepository.update(id, {
      isVerified: !service.isVerified,
    });
    return this.findOne(id);
  }

  async getByUser(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<Service>> {
    const [services, total] = await this.serviceRepository.findAndCount({
      where: { userId },
      relations: ['category', 'images'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: services,
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

  // Review methods
  async createReview(
    serviceId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ServiceReview> {
    const service = await this.findOne(serviceId);

    // Check if user is not the owner
    if (service.userId === userId) {
      throw new ForbiddenException('You cannot review your own service');
    }

    // Check if user already reviewed
    const existing = await this.reviewRepository.findOne({
      where: { serviceId, userId },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this service');
    }

    const review = this.reviewRepository.create({
      serviceId,
      userId,
      ...dto,
    });

    const savedReview = await this.reviewRepository.save(review);

    // Update service rating and count
    await this.updateServiceRating(serviceId);

    return this.findReview(savedReview.id, userId);
  }

  async findReviews(
    serviceId: string,
    page: number = 1,
    limit: number = 20,
    currentUserId?: string,
  ): Promise<PaginatedResult<ServiceReview>> {
    const [reviews, total] = await this.reviewRepository.findAndCount({
      where: { serviceId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (currentUserId) {
      reviews.forEach((review) => {
        review.isOwner = review.userId === currentUserId;
      });
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: reviews,
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

  async findReview(id: string, currentUserId?: string): Promise<ServiceReview> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (currentUserId) {
      review.isOwner = review.userId === currentUserId;
    }

    return review;
  }

  async updateReview(
    id: string,
    userId: string,
    dto: UpdateReviewDto,
  ): Promise<ServiceReview> {
    const review = await this.findReview(id);

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    await this.reviewRepository.update(id, dto);

    // Update service rating if rating changed
    if (dto.rating !== undefined) {
      await this.updateServiceRating(review.serviceId);
    }

    return this.findReview(id, userId);
  }

  async deleteReview(id: string, userId: string): Promise<void> {
    const review = await this.findReview(id);

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const serviceId = review.serviceId;

    await this.reviewRepository.delete(id);

    // Update service rating
    await this.updateServiceRating(serviceId);
  }

  // Private helpers
  private async updateServiceRating(serviceId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.service_id = :serviceId', { serviceId })
      .getRawOne();

    await this.serviceRepository.update(serviceId, {
      ratingAvg: parseFloat(result.avg) || 0,
      reviewsCount: parseInt(result.count, 10) || 0,
    });
  }
}
