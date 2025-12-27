import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '@modules/media/media.module.js';

// Listings Entities
import {
  Listing,
  ListingCategory,
  ListingImage,
  ListingFavorite,
} from './listings/entities/index.js';

// Parts Entities
import {
  Part,
  PartsCategory,
  PartImage,
} from './parts/entities/index.js';

// Listings Services
import { ListingsService } from './listings/listings.service.js';
import { CategoriesService } from './listings/categories.service.js';
import { FavoritesService } from './listings/favorites.service.js';

// Parts Services
import { PartsService } from './parts/parts.service.js';
import { PartsCategoriesService } from './parts/parts-categories.service.js';

// Listings Controllers
import { ListingsController } from './listings/listings.controller.js';
import { CategoriesController } from './listings/categories.controller.js';
import { FavoritesController } from './listings/favorites.controller.js';

// Parts Controllers
import { PartsController } from './parts/parts.controller.js';
import { PartsCategoriesController } from './parts/parts-categories.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Listings
      Listing,
      ListingCategory,
      ListingImage,
      ListingFavorite,
      // Parts
      Part,
      PartsCategory,
      PartImage,
    ]),
    MediaModule,
  ],
  controllers: [
    // Listings
    ListingsController,
    CategoriesController,
    FavoritesController,
    // Parts
    PartsController,
    PartsCategoriesController,
  ],
  providers: [
    // Listings
    ListingsService,
    CategoriesService,
    FavoritesService,
    // Parts
    PartsService,
    PartsCategoriesService,
  ],
  exports: [
    // Listings
    ListingsService,
    CategoriesService,
    FavoritesService,
    // Parts
    PartsService,
    PartsCategoriesService,
  ],
})
export class MarketplaceModule {}
