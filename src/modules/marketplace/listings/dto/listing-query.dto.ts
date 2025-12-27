import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsUUID,
  IsNumber,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCondition, ListingStatus } from '../entities/listing.entity.js';

export enum ListingSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  VIEWS = 'views',
}

export class ListingQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Minimum price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Maximum price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: ListingCondition,
    description: 'Filter by condition',
  })
  @IsOptional()
  @IsEnum(ListingCondition)
  condition?: ListingCondition;

  @ApiPropertyOptional({
    example: 'Tbilisi',
    description: 'Filter by location (partial match)',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 41.7151,
    description: 'Latitude for radius search',
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({
    example: 44.8271,
    description: 'Longitude for radius search',
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Radius in kilometers for location search',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radius?: number = 50;

  @ApiPropertyOptional({
    enum: ListingStatus,
    description: 'Filter by status',
    default: ListingStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @ApiPropertyOptional({
    enum: ListingSortBy,
    description: 'Sort by field',
    default: ListingSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(ListingSortBy)
  sortBy?: ListingSortBy = ListingSortBy.NEWEST;
}

export class ListingSearchDto extends ListingQueryDto {
  @ApiPropertyOptional({
    example: 'honda cbr',
    description: 'Search query for title and description',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
