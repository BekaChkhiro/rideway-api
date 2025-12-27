import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { R2Service } from './r2.service.js';

@Module({
  // ConfigModule is global (isGlobal: true), so no need to import here
  // r2Config is already loaded in the main ConfigModule
  controllers: [MediaController],
  providers: [MediaService, R2Service],
  exports: [MediaService, R2Service],
})
export class MediaModule {}
