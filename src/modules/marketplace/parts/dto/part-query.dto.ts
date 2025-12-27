import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartCondition, PartStatus } from '../entities/part.entity.js';

export enum PartSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  VIEWS = 'views',
}

export class PartQueryDto {
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
    example: 50,
    description: 'Minimum price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 500,
    description: 'Maximum price',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: PartCondition,
    description: 'Filter by condition',
  })
  @IsOptional()
  @IsEnum(PartCondition)
  condition?: PartCondition;

  @ApiPropertyOptional({
    example: 'Honda',
    description: 'Filter by brand',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    example: 'Honda CBR600RR',
    description: 'Filter by compatible motorcycle model',
  })
  @IsOptional()
  @IsString()
  compatibleWith?: string;

  @ApiPropertyOptional({
    example: 'Tbilisi',
    description: 'Filter by location (partial match)',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    enum: PartStatus,
    description: 'Filter by status',
    default: PartStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(PartStatus)
  status?: PartStatus;

  @ApiPropertyOptional({
    enum: PartSortBy,
    description: 'Sort by field',
    default: PartSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(PartSortBy)
  sortBy?: PartSortBy = PartSortBy.NEWEST;
}

export class PartSearchDto extends PartQueryDto {
  @ApiPropertyOptional({
    example: 'brake pads',
    description: 'Search query for title and description',
  })
  @IsOptional()
  @IsString()
  q?: string;
}

export class CompatibilitySearchDto {
  @ApiPropertyOptional({
    example: 'Honda CBR600RR',
    description: 'Motorcycle model to search compatible parts for',
  })
  @IsOptional()
  @IsString()
  model?: string;

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
}
