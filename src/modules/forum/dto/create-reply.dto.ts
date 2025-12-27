import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReplyDto {
  @ApiProperty({
    example: 'I think the Honda CB500 is a great choice...',
    description: 'Reply content',
  })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Parent reply ID (for nested replies)',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
