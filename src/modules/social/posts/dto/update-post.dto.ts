import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostVisibility } from '../entities/post.entity.js';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Updated post content #bikelife',
    description: 'Post content (max 5000 characters)',
    maxLength: 5000,
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    enum: PostVisibility,
    description: 'Post visibility',
  })
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of image IDs to delete',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deleteImageIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of new image URLs to add',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
