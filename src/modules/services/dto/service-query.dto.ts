import {
  IsOptional,
  IsUUID,
  IsString,
  IsNumber,
  IsInt,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ServiceSortBy {
  RATING = 'rating',
  REVIEWS = 'reviews',
  NEWEST = 'newest',
  DISTANCE = 'distance',
}

export class ServiceQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Tbilisi',
    description: 'Filter by city',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: 41.7151,
    description: 'User latitude for distance calculation',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: 44.8271,
    description: 'User longitude for distance calculation',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Search radius in kilometers',
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  radius?: number = 50;

  @ApiPropertyOptional({
    example: 'moto',
    description: 'Search query',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ServiceSortBy,
    example: ServiceSortBy.RATING,
    description: 'Sort by field',
    default: ServiceSortBy.RATING,
  })
  @IsOptional()
  @IsEnum(ServiceSortBy)
  sortBy?: ServiceSortBy = ServiceSortBy.RATING;

  @ApiPropertyOptional({
    example: true,
    description: 'Only show verified services',
  })
  @IsOptional()
  @Type(() => Boolean)
  verified?: boolean;
}
