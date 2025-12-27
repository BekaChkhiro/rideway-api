import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PartCondition,
  PartCurrency,
  PartStatus,
} from '../entities/part.entity.js';

export class CreatePartDto {
  @ApiProperty({
    example: 'Honda CBR600RR Brake Pads',
    description: 'Part title',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    example: 'Original Honda brake pads in excellent condition...',
    description: 'Detailed description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 150,
    description: 'Price amount',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    enum: PartCurrency,
    default: PartCurrency.GEL,
    description: 'Price currency',
  })
  @IsOptional()
  @IsEnum(PartCurrency)
  currency?: PartCurrency = PartCurrency.GEL;

  @ApiPropertyOptional({
    enum: PartCondition,
    description: 'Part condition',
  })
  @IsOptional()
  @IsEnum(PartCondition)
  condition?: PartCondition;

  @ApiPropertyOptional({
    example: 'Honda',
    description: 'Brand name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({
    example: 'HN-BP-600R',
    description: 'Part number / SKU',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partNumber?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Honda CBR600RR 2007-2012', 'Honda CBR1000RR 2008-2011'],
    description: 'Compatible motorcycle models',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compatibility?: string[];

  @ApiPropertyOptional({
    example: 'Tbilisi, Georgia',
    description: 'Location',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Category UUID',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: PartStatus,
    default: PartStatus.ACTIVE,
    description: 'Part status',
  })
  @IsOptional()
  @IsEnum(PartStatus)
  status?: PartStatus = PartStatus.ACTIVE;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of image URLs (if already uploaded)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
