import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'General Discussion',
    description: 'Category name',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'general-discussion',
    description: 'URL-friendly slug',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional({
    example: 'A place for general motorcycle discussions',
    description: 'Category description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'chat-bubble',
    description: 'Icon identifier',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    example: '#4F46E5',
    description: 'Category color (hex)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;
}
