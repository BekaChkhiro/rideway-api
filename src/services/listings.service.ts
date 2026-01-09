import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { uploadFiles, deleteFiles, extractKeyFromUrl } from './media.service';
import {
  CreateListingInput,
  UpdateListingInput,
  GetListingsQuery,
  SearchListingsQuery,
  PopularListingsQuery,
  UserListingsQuery,
} from '../validators/listings';
import { ListingCondition, ListingStatus, Prisma } from '@prisma/client';

interface ListingAuthor {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ListingImage {
  id: string;
  url: string;
  order: number;
}

interface ListingCategory {
  id: string;
  name: string;
  slug: string;
}

interface ListingResponse {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: ListingCondition;
  location: string;
  status: ListingStatus;
  viewCount: number;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  engineSize: number | null;
  author: ListingAuthor;
  category: ListingCategory;
  images: ListingImage[];
  isFavorite: boolean;
  favoriteCount: number;
  createdAt: Date;
  updatedAt: Date;
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

interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  parentId: string | null;
  children?: CategoryResponse[];
}

export const listingsService = {
  // ==================== CATEGORIES ====================

  async getCategories(): Promise<CategoryResponse[]> {
    const categories = await prisma.listingCategory.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      order: cat.order,
      parentId: cat.parentId,
      children: cat.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        icon: child.icon,
        order: child.order,
        parentId: child.parentId,
      })),
    }));
  },

  // ==================== LISTINGS CRUD ====================

  async createListing(
    userId: string,
    data: CreateListingInput,
    files?: Express.Multer.File[]
  ): Promise<ListingResponse> {
    // Verify category exists
    const category = await prisma.listingCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      throw new AppError(404, 'NOT_FOUND', 'კატეგორია ვერ მოიძებნა');
    }

    // Upload images if provided
    let imageUrls: { url: string }[] = [];
    if (files && files.length > 0) {
      const uploadResults = await uploadFiles(files, 'listings', userId);
      imageUrls = uploadResults.map((r) => ({ url: r.url }));
    }

    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        currency: data.currency,
        categoryId: data.categoryId,
        userId,
        condition: data.condition as ListingCondition,
        location: data.location,
        brand: data.brand,
        model: data.model,
        year: data.year,
        mileage: data.mileage,
        engineSize: data.engineSize,
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
        _count: {
          select: { favorites: true },
        },
      },
    });

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      viewCount: listing.viewCount,
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engineSize: listing.engineSize,
      author: {
        id: listing.user.id,
        username: listing.user.username,
        fullName: listing.user.fullName,
        avatarUrl: listing.user.avatarUrl,
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
      },
      images: listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: false,
      favoriteCount: listing._count.favorites,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  },

  async getListingById(listingId: string, currentUserId?: string): Promise<ListingResponse> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
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
        _count: {
          select: { favorites: true },
        },
      },
    });

    if (!listing || listing.status === 'DELETED' || !listing.user.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'განცხადება ვერ მოიძებნა');
    }

    // Check if favorite
    let isFavorite = false;
    if (currentUserId) {
      const favorite = await prisma.listingFavorite.findUnique({
        where: {
          userId_listingId: { userId: currentUserId, listingId },
        },
      });
      isFavorite = !!favorite;
    }

    // Increment view count
    await prisma.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      viewCount: listing.viewCount + 1,
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engineSize: listing.engineSize,
      author: {
        id: listing.user.id,
        username: listing.user.username,
        fullName: listing.user.fullName,
        avatarUrl: listing.user.avatarUrl,
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
      },
      images: listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite,
      favoriteCount: listing._count.favorites,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  },

  async getListings(
    query: GetListingsQuery,
    currentUserId?: string
  ): Promise<PaginatedResult<ListingResponse>> {
    const { page, limit, categoryId, minPrice, maxPrice, condition, location, brand, status, sort } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {
      status: status as ListingStatus,
      user: { isActive: true },
      ...(categoryId && { categoryId }),
      ...(condition && { condition: condition as ListingCondition }),
      ...(location && { location: { contains: location, mode: 'insensitive' as const } }),
      ...(brand && { brand: { contains: brand, mode: 'insensitive' as const } }),
    };

    // Build price filter properly
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Determine sort order
    let orderBy: Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[];
    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'popular':
        orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'latest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
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
          _count: {
            select: { favorites: true },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.listing.count({ where }),
    ]);

    // Get favorite status
    let favoriteIds = new Set<string>();
    if (currentUserId) {
      const listingIds = listings.map((l) => l.id);
      const favorites = await prisma.listingFavorite.findMany({
        where: {
          userId: currentUserId,
          listingId: { in: listingIds },
        },
        select: { listingId: true },
      });
      favoriteIds = new Set(favorites.map((f) => f.listingId));
    }

    const items: ListingResponse[] = listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      viewCount: listing.viewCount,
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engineSize: listing.engineSize,
      author: {
        id: listing.user.id,
        username: listing.user.username,
        fullName: listing.user.fullName,
        avatarUrl: listing.user.avatarUrl,
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
      },
      images: listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: favoriteIds.has(listing.id),
      favoriteCount: listing._count.favorites,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
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

  async searchListings(
    query: SearchListingsQuery,
    currentUserId?: string
  ): Promise<PaginatedResult<ListingResponse>> {
    const { q, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      user: { isActive: true },
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
      ],
    };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
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
          _count: {
            select: { favorites: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.listing.count({ where }),
    ]);

    // Get favorite status
    let favoriteIds = new Set<string>();
    if (currentUserId) {
      const listingIds = listings.map((l) => l.id);
      const favorites = await prisma.listingFavorite.findMany({
        where: {
          userId: currentUserId,
          listingId: { in: listingIds },
        },
        select: { listingId: true },
      });
      favoriteIds = new Set(favorites.map((f) => f.listingId));
    }

    const items: ListingResponse[] = listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      viewCount: listing.viewCount,
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engineSize: listing.engineSize,
      author: {
        id: listing.user.id,
        username: listing.user.username,
        fullName: listing.user.fullName,
        avatarUrl: listing.user.avatarUrl,
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
      },
      images: listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: favoriteIds.has(listing.id),
      favoriteCount: listing._count.favorites,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
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

  async getPopularListings(
    query: PopularListingsQuery,
    currentUserId?: string
  ): Promise<ListingResponse[]> {
    const { limit } = query;

    const listings = await prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        user: { isActive: true },
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
          take: 1,
        },
        _count: {
          select: { favorites: true },
        },
      },
      take: limit,
      orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
    });

    // Get favorite status
    let favoriteIds = new Set<string>();
    if (currentUserId) {
      const listingIds = listings.map((l) => l.id);
      const favorites = await prisma.listingFavorite.findMany({
        where: {
          userId: currentUserId,
          listingId: { in: listingIds },
        },
        select: { listingId: true },
      });
      favoriteIds = new Set(favorites.map((f) => f.listingId));
    }

    return listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      viewCount: listing.viewCount,
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engineSize: listing.engineSize,
      author: {
        id: listing.user.id,
        username: listing.user.username,
        fullName: listing.user.fullName,
        avatarUrl: listing.user.avatarUrl,
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
      },
      images: listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: favoriteIds.has(listing.id),
      favoriteCount: listing._count.favorites,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    }));
  },

  async getUserListings(
    targetUserId: string,
    query: UserListingsQuery,
    currentUserId?: string
  ): Promise<PaginatedResult<ListingResponse>> {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    const where: Prisma.ListingWhereInput = {
      userId: targetUserId,
      status: status ? (status as ListingStatus) : { not: 'DELETED' },
    };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
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
          _count: {
            select: { favorites: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.listing.count({ where }),
    ]);

    // Get favorite status
    let favoriteIds = new Set<string>();
    if (currentUserId) {
      const listingIds = listings.map((l) => l.id);
      const favorites = await prisma.listingFavorite.findMany({
        where: {
          userId: currentUserId,
          listingId: { in: listingIds },
        },
        select: { listingId: true },
      });
      favoriteIds = new Set(favorites.map((f) => f.listingId));
    }

    const items: ListingResponse[] = listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      currency: listing.currency,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      viewCount: listing.viewCount,
      brand: listing.brand,
      model: listing.model,
      year: listing.year,
      mileage: listing.mileage,
      engineSize: listing.engineSize,
      author: {
        id: listing.user.id,
        username: listing.user.username,
        fullName: listing.user.fullName,
        avatarUrl: listing.user.avatarUrl,
      },
      category: {
        id: listing.category.id,
        name: listing.category.name,
        slug: listing.category.slug,
      },
      images: listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: favoriteIds.has(listing.id),
      favoriteCount: listing._count.favorites,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
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

  async updateListing(
    listingId: string,
    userId: string,
    data: UpdateListingInput
  ): Promise<ListingResponse> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.status === 'DELETED') {
      throw new AppError(404, 'NOT_FOUND', 'განცხადება ვერ მოიძებნა');
    }

    if (listing.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ რედაქტირების უფლება');
    }

    // If category is being changed, verify it exists
    if (data.categoryId) {
      const category = await prisma.listingCategory.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new AppError(404, 'NOT_FOUND', 'კატეგორია ვერ მოიძებნა');
      }
    }

    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.currency && { currency: data.currency }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.condition && { condition: data.condition as ListingCondition }),
        ...(data.location && { location: data.location }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.mileage !== undefined && { mileage: data.mileage }),
        ...(data.engineSize !== undefined && { engineSize: data.engineSize }),
        ...(data.status && { status: data.status as ListingStatus }),
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
        _count: {
          select: { favorites: true },
        },
      },
    });

    return {
      id: updatedListing.id,
      title: updatedListing.title,
      description: updatedListing.description,
      price: Number(updatedListing.price),
      currency: updatedListing.currency,
      condition: updatedListing.condition,
      location: updatedListing.location,
      status: updatedListing.status,
      viewCount: updatedListing.viewCount,
      brand: updatedListing.brand,
      model: updatedListing.model,
      year: updatedListing.year,
      mileage: updatedListing.mileage,
      engineSize: updatedListing.engineSize,
      author: {
        id: updatedListing.user.id,
        username: updatedListing.user.username,
        fullName: updatedListing.user.fullName,
        avatarUrl: updatedListing.user.avatarUrl,
      },
      category: {
        id: updatedListing.category.id,
        name: updatedListing.category.name,
        slug: updatedListing.category.slug,
      },
      images: updatedListing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: false,
      favoriteCount: updatedListing._count.favorites,
      createdAt: updatedListing.createdAt,
      updatedAt: updatedListing.updatedAt,
    };
  },

  async deleteListing(listingId: string, userId: string): Promise<void> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        images: true,
      },
    });

    if (!listing || listing.status === 'DELETED') {
      throw new AppError(404, 'NOT_FOUND', 'განცხადება ვერ მოიძებნა');
    }

    if (listing.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ წაშლის უფლება');
    }

    // Soft delete
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'DELETED' },
    });

    // Delete images from R2
    const imageKeys = listing.images
      .map((img) => extractKeyFromUrl(img.url))
      .filter((key): key is string => key !== null);

    if (imageKeys.length > 0) {
      await deleteFiles(imageKeys);
    }
  },

  async markAsSold(listingId: string, userId: string): Promise<ListingResponse> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.status === 'DELETED') {
      throw new AppError(404, 'NOT_FOUND', 'განცხადება ვერ მოიძებნა');
    }

    if (listing.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'არ გაქვთ ამ მოქმედების უფლება');
    }

    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: { status: 'SOLD' },
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
        _count: {
          select: { favorites: true },
        },
      },
    });

    return {
      id: updatedListing.id,
      title: updatedListing.title,
      description: updatedListing.description,
      price: Number(updatedListing.price),
      currency: updatedListing.currency,
      condition: updatedListing.condition,
      location: updatedListing.location,
      status: updatedListing.status,
      viewCount: updatedListing.viewCount,
      brand: updatedListing.brand,
      model: updatedListing.model,
      year: updatedListing.year,
      mileage: updatedListing.mileage,
      engineSize: updatedListing.engineSize,
      author: {
        id: updatedListing.user.id,
        username: updatedListing.user.username,
        fullName: updatedListing.user.fullName,
        avatarUrl: updatedListing.user.avatarUrl,
      },
      category: {
        id: updatedListing.category.id,
        name: updatedListing.category.name,
        slug: updatedListing.category.slug,
      },
      images: updatedListing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: false,
      favoriteCount: updatedListing._count.favorites,
      createdAt: updatedListing.createdAt,
      updatedAt: updatedListing.updatedAt,
    };
  },

  // ==================== FAVORITES ====================

  async toggleFavorite(
    listingId: string,
    userId: string
  ): Promise<{ isFavorite: boolean; favoriteCount: number }> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true },

    });

    if (!listing || listing.status === 'DELETED') {
      throw new AppError(404, 'NOT_FOUND', 'განცხადება ვერ მოიძებნა');
    }

    const existingFavorite = await prisma.listingFavorite.findUnique({
      where: {
        userId_listingId: { userId, listingId },
      },
    });

    if (existingFavorite) {
      // Remove from favorites
      await prisma.listingFavorite.delete({
        where: { id: existingFavorite.id },
      });

      const count = await prisma.listingFavorite.count({
        where: { listingId },
      });

      return { isFavorite: false, favoriteCount: count };
    } else {
      // Add to favorites
      await prisma.listingFavorite.create({
        data: { userId, listingId },
      });

      const count = await prisma.listingFavorite.count({
        where: { listingId },
      });

      return { isFavorite: true, favoriteCount: count };
    }
  },

  async getFavorites(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<ListingResponse>> {
    const skip = (page - 1) * limit;

    const where = {
      userId,
      listing: {
        status: { not: 'DELETED' as const },
        user: { isActive: true },
      },
    };

    const [favorites, total] = await Promise.all([
      prisma.listingFavorite.findMany({
        where,
        include: {
          listing: {
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
              _count: {
                select: { favorites: true },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.listingFavorite.count({ where }),
    ]);

    const items: ListingResponse[] = favorites.map((fav) => ({
      id: fav.listing.id,
      title: fav.listing.title,
      description: fav.listing.description,
      price: Number(fav.listing.price),
      currency: fav.listing.currency,
      condition: fav.listing.condition,
      location: fav.listing.location,
      status: fav.listing.status,
      viewCount: fav.listing.viewCount,
      brand: fav.listing.brand,
      model: fav.listing.model,
      year: fav.listing.year,
      mileage: fav.listing.mileage,
      engineSize: fav.listing.engineSize,
      author: {
        id: fav.listing.user.id,
        username: fav.listing.user.username,
        fullName: fav.listing.user.fullName,
        avatarUrl: fav.listing.user.avatarUrl,
      },
      category: {
        id: fav.listing.category.id,
        name: fav.listing.category.name,
        slug: fav.listing.category.slug,
      },
      images: fav.listing.images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
      })),
      isFavorite: true,
      favoriteCount: fav.listing._count.favorites,
      createdAt: fav.listing.createdAt,
      updatedAt: fav.listing.updatedAt,
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
};
