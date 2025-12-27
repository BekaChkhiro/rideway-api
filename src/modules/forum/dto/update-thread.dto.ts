import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateThreadDto {
  @ApiPropertyOptional({
    example: 'Updated thread title',
    description: 'New thread title',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated thread content...',
    description: 'New thread content',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;
}
