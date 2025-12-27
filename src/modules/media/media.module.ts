import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { R2Service } from './r2.service';
import r2Config from '@config/r2.config';

@Module({
  imports: [ConfigModule.forFeature(r2Config)],
  controllers: [MediaController],
  providers: [MediaService, R2Service],
  exports: [MediaService, R2Service],
})
export class MediaModule {}
