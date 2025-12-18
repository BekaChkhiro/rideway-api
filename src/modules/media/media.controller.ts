import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { UploadResponseDto, MultipleUploadResponseDto, DeleteResponseDto } from './dto';
import type { ImageFolder } from './interfaces/upload-options.interface';

interface JwtUser {
  sub: string;
  email: string;
}

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiQuery({
    name: 'folder',
    enum: ['avatars', 'covers', 'posts', 'listings', 'general'],
    required: false,
    description: 'Folder to upload to (default: general)',
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully', type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file or file type' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Query('folder') folder?: ImageFolder,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const targetFolder = folder || 'general';
    const validFolders: ImageFolder[] = ['avatars', 'covers', 'posts', 'listings', 'thumbnails', 'general'];

    if (!validFolders.includes(targetFolder)) {
      throw new BadRequestException(`Invalid folder. Allowed: ${validFolders.join(', ')}`);
    }

    return this.mediaService.uploadImage(file, targetFolder, user.sub);
  }

  @Post('upload-multiple')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload multiple images (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiQuery({
    name: 'folder',
    enum: ['avatars', 'covers', 'posts', 'listings', 'general'],
    required: false,
    description: 'Folder to upload to (default: general)',
  })
  @ApiResponse({ status: 201, description: 'Files uploaded successfully', type: MultipleUploadResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid files or too many files' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtUser,
    @Query('folder') folder?: ImageFolder,
  ): Promise<MultipleUploadResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const targetFolder = folder || 'general';
    const validFolders: ImageFolder[] = ['avatars', 'covers', 'posts', 'listings', 'thumbnails', 'general'];

    if (!validFolders.includes(targetFolder)) {
      throw new BadRequestException(`Invalid folder. Allowed: ${validFolders.join(', ')}`);
    }

    const uploads = await this.mediaService.uploadImages(files, targetFolder, user.sub);

    return {
      uploads,
      count: uploads.length,
    };
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a file by key' })
  @ApiResponse({ status: 200, description: 'File deleted successfully', type: DeleteResponseDto })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(
    @Param('key') key: string,
    @CurrentUser() _user: JwtUser,
  ): Promise<DeleteResponseDto> {
    // Note: In production, verify file ownership using metadata
    await this.mediaService.deleteByKey(key);

    return {
      success: true,
      key,
    };
  }
}
