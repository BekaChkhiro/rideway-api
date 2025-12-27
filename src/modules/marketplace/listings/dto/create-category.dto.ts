import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Sport Bikes',
    description: 'Category name',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'sport-bikes',
    description: 'URL-friendly slug',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase with hyphens only',
  })
  slug!: string;

  @ApiPropertyOptional({
    example: 'motorcycle-sport',
    description: 'Icon name/class',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Parent category ID',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Sort order',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    example: 'Sport Bikes',
    description: 'Category name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'sport-bikes',
    description: 'URL-friendly slug',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase with hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'motorcycle-sport',
    description: 'Icon name/class',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Parent category ID',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Sort order',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
