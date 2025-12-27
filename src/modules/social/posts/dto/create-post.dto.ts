import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostVisibility } from '../entities/post.entity.js';

export class CreatePostDto {
  @ApiProperty({
    example: 'Just finished an amazing ride through the mountains! #bikelife #adventure',
    description: 'Post content (max 5000 characters)',
    maxLength: 5000,
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({
    enum: PostVisibility,
    default: PostVisibility.PUBLIC,
    description: 'Post visibility',
  })
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility = PostVisibility.PUBLIC;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of image URLs (if already uploaded)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Original post ID if this is a repost/quote',
  })
  @IsOptional()
  @IsUUID()
  originalPostId?: string;
}
