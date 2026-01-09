import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { notificationsService } from './notifications.service';
import { uploadFiles, deleteFiles, extractKeyFromUrl } from './media.service';
import {
  CreateServiceInput,
  UpdateServiceInput,
  GetServicesQuery,
  SearchServicesQuery,
  CreateReviewInput,
  GetReviewsQuery,
} from '../validators/services';
import { Prisma } from '@prisma/client';

interface ServiceAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ServiceImage {
  id: string;
  url: string;
  order: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
}

interface ServiceResponse {
  id: string;
  name: string;
  description: string;
  location: string;
  address: string | null;
  phone: string | null;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  owner: ServiceAuthor;
  category: ServiceCategory;
  images: ServiceImage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ReviewAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ReviewResponse {
  id: string;
  rating: number;
  comment: string | null;
  author: ReviewAuthor;
  createdAt: Date;
}

interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  serviceCount?: number;
}

interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const servicesService = {
  // ==================== CATEGORIES ====================

  async getCategories(): Promise<CategoryResponse[]> {
    const categories = await prisma.serviceCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      order: cat.order,
      serviceCount: cat._count.services,
    }));
  },

  // ==================== SERVICES CRUD ====================

  async createService(
    userId: string,
    data: CreateServiceInput,
    files?: Express.Multer.File[]
  ): Promise<ServiceResponse> {
    // Verify category exists
    const category = await prisma.serviceCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new AppError(404, 'NOT_FOUND', 'კატეგორია ვერ მოიძებნა');
    }

    // Upload images if provided
    let imageUrls: { url: string }[] = [];
    if (files && files.length > 0) {
      const uploadResults = await uploadFiles(files, 'services', userId);
      imageUrls = uploadResults.map((r) => ({ url: r.url }));
    }

    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        userId,
        location: data.location,
        address: data.address,
        phone: data.phone,
        images: {
          create: imageUrls.map((img, index) => ({
            url: img.url,
            order: index,
          })),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      location: service.location,
      address: service.address,
      phone: service.phone,
      isVerified: service.isVerified,
      rating: Number(service.rating),
      reviewCount: service.reviewCount,
      owner: {
        id: service.user.id,
        username: service.user.username,
        fullName: service.user.fullName,
        avatarUrl: service.user.avatarUrl,
      },
      category: {
        id: service.category.id,
        name: service.category.name,
        slug: service.category.slug,
      },
      images: service.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  },

  async getServiceById(serviceId: string): Promise<ServiceResponse> {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!service || !service.user.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'სერვისი ვერ მოიძებნა');
    }

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      location: service.location,
      address: service.address,
      phone: service.phone,
      isVerified: service.isVerified,
      rating: Number(service.rating),
      reviewCount: service.reviewCount,
      owner: {
        id: service.user.id,
        username: service.user.username,
        fullName: service.user.fullName,
        avatarUrl: service.user.avatarUrl,
      },
      category: {
        id: service.category.id,
        name: service.category.name,
        slug: service.category.slug,
      },
      images: service.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  },

  async getServices(query: GetServicesQuery): Promise<PaginatedResult<ServiceResponse>> {
    const { page, limit, categoryId, location, sort } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {
      user: { isActive: true },
      ...(categoryId && { categoryId }),
      ...(location && { location: { contains: location, mode: 'insensitive' as const } }),
    };

    // Determine sort order
    let orderBy: Prisma.ServiceOrderByWithRelationInput | Prisma.ServiceOrderByWithRelationInput[];
    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'rating':
        orderBy = [{ rating: 'desc' }, { reviewCount: 'desc' }];
        break;
      case 'most_reviews':
        orderBy = [{ reviewCount: 'desc' }, { rating: 'desc' }];
        break;
      case 'latest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
            take: 1, // Only first image for list view
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.service.count({ where }),
    ]);

    const items: ServiceResponse[] = services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      location: service.location,
      address: service.address,
      phone: service.phone,
      isVerified: service.isVerified,
      rating: Number(service.rating),
      reviewCount: service.reviewCount,
      owner: {
        id: service.user.id,
        username: service.user.username,
        fullName: service.user.fullName,
        avatarUrl: service.user.avatarUrl,
      },
      category: {
        id: service.category.id,
        name: service.category.name,
        slug: service.category.slug,
      },
      images: service.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async searchServices(query: SearchServicesQuery): Promise<PaginatedResult<ServiceResponse>> {
    const { q, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {
      user: { isActive: true },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ],
    };

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
        skip,
        take: limit,
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.service.count({ where }),
    ]);

    const items: ServiceResponse[] = services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      location: service.location,
      address: service.address,
      phone: service.phone,
      isVerified: service.isVerified,
      rating: Number(service.rating),
      reviewCount: service.reviewCount,
      owner: {
        id: service.user.id,
        username: service.user.username,
        fullName: service.user.fullName,
        avatarUrl: service.user.avatarUrl,
      },
      category: {
        id: service.category.id,
        name: service.category.name,
        slug: service.category.slug,
      },
      images: service.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getUserServices(
    targetUserId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<ServiceResponse>> {
    const skip = (page - 1) * limit;

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    const where = { userId: targetUserId };

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.service.count({ where }),
    ]);

    const items: ServiceResponse[] = services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      location: service.location,
      address: service.address,
      phone: service.phone,
      isVerified: service.isVerified,
      rating: Number(service.rating),
      reviewCount: service.reviewCount,
      owner: {
        id: service.user.id,
        username: service.user.username,
        fullName: service.user.fullName,
        avatarUrl: service.user.avatarUrl,
      },
      category: {
        id: service.category.id,
        name: service.category.name,
        slug: service.category.slug,
      },
      images: service.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateService(
    serviceId: string,
    userId: string,
    data: UpdateServiceInput
  ): Promise<ServiceResponse> {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'სერვისი ვერ მოიძებნა');
    }

    if (service.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ რედაქტირების უფლება');
    }

    // If category is being changed, verify it exists
    if (data.categoryId) {
      const category = await prisma.serviceCategory.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new AppError(404, 'NOT_FOUND', 'კატეგორია ვერ მოიძებნა');
      }
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description && { description: data.description }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.location && { location: data.location }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return {
      id: updatedService.id,
      name: updatedService.name,
      description: updatedService.description,
      location: updatedService.location,
      address: updatedService.address,
      phone: updatedService.phone,
      isVerified: updatedService.isVerified,
      rating: Number(updatedService.rating),
      reviewCount: updatedService.reviewCount,
      owner: {
        id: updatedService.user.id,
        username: updatedService.user.username,
        fullName: updatedService.user.fullName,
        avatarUrl: updatedService.user.avatarUrl,
      },
      category: {
        id: updatedService.category.id,
        name: updatedService.category.name,
        slug: updatedService.category.slug,
      },
      images: updatedService.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      createdAt: updatedService.createdAt,
      updatedAt: updatedService.updatedAt,
    };
  },

  async deleteService(serviceId: string, userId: string): Promise<void> {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        images: true,
      },
    });

    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'სერვისი ვერ მოიძებნა');
    }

    if (service.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ წაშლის უფლება');
    }

    // Delete service (cascades to images and reviews)
    await prisma.service.delete({
      where: { id: serviceId },
    });

    // Delete images from R2
    const imageKeys = service.images
      .map((img) => extractKeyFromUrl(img.url))
      .filter((key): key is string => key !== null);

    if (imageKeys.length > 0) {
      await deleteFiles(imageKeys);
    }
  },

  // ==================== REVIEWS ====================

  async createReview(
    serviceId: string,
    userId: string,
    data: CreateReviewInput
  ): Promise<ReviewResponse> {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, userId: true, name: true },
    });

    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'სერვისი ვერ მოიძებნა');
    }

    // Can't review own service
    if (service.userId === userId) {
      throw new AppError(400, 'BAD_REQUEST', 'საკუთარ სერვისს ვერ შეაფასებთ');
    }

    // Check if already reviewed
    const existingReview = await prisma.serviceReview.findUnique({
      where: {
        serviceId_userId: { serviceId, userId },
      },
    });

    if (existingReview) {
      throw new AppError(409, 'CONFLICT', 'თქვენ უკვე შეაფასეთ ეს სერვისი');
    }

    const review = await prisma.serviceReview.create({
      data: {
        serviceId,
        userId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update service rating and count
    const stats = await prisma.serviceReview.aggregate({
      where: { serviceId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.service.update({
      where: { id: serviceId },
      data: {
        rating: stats._avg.rating || 0,
        reviewCount: stats._count.id,
      },
    });

    // Send notification to service owner
    await notificationsService.createNotification({
      userId: service.userId,
      type: 'SERVICE_REVIEW',
      title: 'ახალი შეფასება',
      body: `მომხმარებელმა შეაფასა თქვენი სერვისი "${service.name}" - ${data.rating} ვარსკვლავი`,
      data: { serviceId, reviewId: review.id, rating: data.rating },
    });

    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      author: {
        id: review.user.id,
        username: review.user.username,
        fullName: review.user.fullName,
        avatarUrl: review.user.avatarUrl,
      },
      createdAt: review.createdAt,
    };
  },

  async getReviews(
    serviceId: string,
    query: GetReviewsQuery
  ): Promise<PaginatedResult<ReviewResponse>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // Check service exists
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });

    if (!service) {
      throw new AppError(404, 'NOT_FOUND', 'სერვისი ვერ მოიძებნა');
    }

    const where = {
      serviceId,
      user: { isActive: true },
    };

    const [reviews, total] = await Promise.all([
      prisma.serviceReview.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.serviceReview.count({ where }),
    ]);

    const items: ReviewResponse[] = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      author: {
        id: review.user.id,
        username: review.user.username,
        fullName: review.user.fullName,
        avatarUrl: review.user.avatarUrl,
      },
      createdAt: review.createdAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deleteReview(serviceId: string, userId: string): Promise<void> {
    const review = await prisma.serviceReview.findUnique({
      where: {
        serviceId_userId: { serviceId, userId },
      },
    });

    if (!review) {
      throw new AppError(404, 'NOT_FOUND', 'შეფასება ვერ მოიძებნა');
    }

    await prisma.serviceReview.delete({
      where: { id: review.id },
    });

    // Update service rating and count
    const stats = await prisma.serviceReview.aggregate({
      where: { serviceId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.service.update({
      where: { id: serviceId },
      data: {
        rating: stats._avg.rating || 0,
        reviewCount: stats._count.id,
      },
    });
  },
};
