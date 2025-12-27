import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StoryMediaType } from '../entities/story.entity.js';

export class CreateStoryDto {
  @ApiPropertyOptional({
    example: 'Check out my new ride!',
    description: 'Story caption (max 500 characters)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @ApiPropertyOptional({
    enum: StoryMediaType,
    default: StoryMediaType.IMAGE,
    description: 'Media type',
  })
  @IsOptional()
  @IsEnum(StoryMediaType)
  mediaType?: StoryMediaType = StoryMediaType.IMAGE;

  @ApiPropertyOptional({
    example: 'https://example.com/media.jpg',
    description: 'Pre-uploaded media URL',
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
