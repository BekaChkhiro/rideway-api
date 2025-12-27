import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@redis/redis.module.js';
import { ServiceCategory } from './entities/service-category.entity.js';
import { Service } from './entities/service.entity.js';
import { ServiceImage } from './entities/service-image.entity.js';
import { ServiceReview } from './entities/service-review.entity.js';
import { ServiceCategoriesService } from './service-categories.service.js';
import { ServicesService } from './services.service.js';
import { ServiceCategoriesController } from './service-categories.controller.js';
import {
  ServicesController,
  ServiceReviewsController,
} from './services.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceCategory,
      Service,
      ServiceImage,
      ServiceReview,
    ]),
    RedisModule,
  ],
  controllers: [
    ServiceCategoriesController,
    ServicesController,
    ServiceReviewsController,
  ],
  providers: [ServiceCategoriesService, ServicesService],
  exports: [ServiceCategoriesService, ServicesService],
})
export class ServicesModule {}
