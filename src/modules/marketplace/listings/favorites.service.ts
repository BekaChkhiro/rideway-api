import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingFavorite } from './entities/listing-favorite.entity.js';
import { Listing, ListingStatus } from './entities/listing.entity.js';

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
export class FavoritesService {
  constructor(
    @InjectRepository(ListingFavorite)
    private readonly favoriteRepository: Repository<ListingFavorite>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async toggle(
    listingId: string,
    userId: string,
  ): Promise<{ isFavorited: boolean }> {
    // Check if listing exists
    const listing = await this.listingRepository.findOne({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if already favorited
    const existing = await this.favoriteRepository.findOne({
      where: { listingId, userId },
    });

    if (existing) {
      // Remove favorite
      await this.favoriteRepository.delete(existing.id);
      return { isFavorited: false };
    }

    // Add favorite
    const favorite = this.favoriteRepository.create({
      listingId,
      userId,
    });
    await this.favoriteRepository.save(favorite);

    return { isFavorited: true };
  }

  async add(listingId: string, userId: string): Promise<ListingFavorite> {
    // Check if listing exists
    const listing = await this.listingRepository.findOne({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if already favorited
    const existing = await this.favoriteRepository.findOne({
      where: { listingId, userId },
    });

    if (existing) {
      return existing;
    }

    const favorite = this.favoriteRepository.create({
      listingId,
      userId,
    });

    return this.favoriteRepository.save(favorite);
  }

  async remove(listingId: string, userId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { listingId, userId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.favoriteRepository.delete(favorite.id);
  }

  async getUserFavorites(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<Listing>> {
    const [favorites, total] = await this.favoriteRepository.findAndCount({
      where: { userId },
      relations: ['listing', 'listing.images', 'listing.category'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Filter out deleted or non-active listings
    const listings = favorites
      .map((f) => f.listing)
      .filter((l) => l && !l.deletedAt && l.status === ListingStatus.ACTIVE)
      .map((l) => {
        l.isFavorited = true;
        return l;
      });

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

  async isFavorited(listingId: string, userId: string): Promise<boolean> {
    const favorite = await this.favoriteRepository.findOne({
      where: { listingId, userId },
    });

    return !!favorite;
  }

  async getFavoriteCount(listingId: string): Promise<number> {
    return this.favoriteRepository.count({
      where: { listingId },
    });
  }
}
