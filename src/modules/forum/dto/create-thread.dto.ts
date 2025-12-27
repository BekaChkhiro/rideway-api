import {
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateThreadDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Category ID',
  })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({
    example: 'Best motorcycle for beginners?',
    description: 'Thread title',
    maxLength: 300,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  title!: string;

  @ApiProperty({
    example: 'I am looking for a good beginner motorcycle...',
    description: 'Thread content',
  })
  @IsString()
  @MinLength(10)
  content!: string;
}
