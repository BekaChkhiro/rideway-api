import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReplyDto {
  @ApiProperty({
    example: 'Updated reply content...',
    description: 'New reply content',
  })
  @IsString()
  @MinLength(1)
  content!: string;
}
