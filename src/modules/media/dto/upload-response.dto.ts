import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ description: 'Public URL of the uploaded file' })
  url!: string;

  @ApiProperty({ description: 'Storage key for the file' })
  key!: string;

  @ApiProperty({ description: 'File size in bytes' })
  size!: number;

  @ApiProperty({ description: 'MIME type of the file' })
  mimetype!: string;

  @ApiPropertyOptional({ description: 'Image width in pixels' })
  width?: number;

  @ApiPropertyOptional({ description: 'Image height in pixels' })
  height?: number;

  @ApiPropertyOptional({ description: 'Thumbnail URL if generated' })
  thumbnailUrl?: string;
}

export class MultipleUploadResponseDto {
  @ApiProperty({ type: [UploadResponseDto], description: 'Array of upload results' })
  uploads!: UploadResponseDto[];

  @ApiProperty({ description: 'Number of successfully uploaded files' })
  count!: number;
}

export class DeleteResponseDto {
  @ApiProperty({ description: 'Whether the deletion was successful' })
  success!: boolean;

  @ApiProperty({ description: 'Deleted file key' })
  key!: string;
}
