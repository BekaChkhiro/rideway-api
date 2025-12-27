import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  MaxLength,
  Min,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ListingCondition,
  ListingCurrency,
  ListingStatus,
} from '../entities/listing.entity.js';

export class CreateListingDto {
  @ApiProperty({
    example: 'Honda CBR600RR 2020',
    description: 'Listing title',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    example: 'Well maintained motorcycle with low mileage...',
    description: 'Detailed description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 15000,
    description: 'Price amount',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    enum: ListingCurrency,
    default: ListingCurrency.GEL,
    description: 'Price currency',
  })
  @IsOptional()
  @IsEnum(ListingCurrency)
  currency?: ListingCurrency = ListingCurrency.GEL;

  @ApiPropertyOptional({
    enum: ListingCondition,
    description: 'Item condition',
  })
  @IsOptional()
  @IsEnum(ListingCondition)
  condition?: ListingCondition;

  @ApiPropertyOptional({
    example: 'Tbilisi, Georgia',
    description: 'Location name',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({
    example: 41.7151,
    description: 'Latitude coordinate',
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({
    example: 44.8271,
    description: 'Longitude coordinate',
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Category UUID',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: ListingStatus,
    default: ListingStatus.ACTIVE,
    description: 'Listing status',
  })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus = ListingStatus.ACTIVE;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of image URLs (if already uploaded)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
