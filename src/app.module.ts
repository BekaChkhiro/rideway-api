import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { MarketplaceModule } from './modules/marketplace/marketplace.module.js';
import { SocialModule } from './modules/social/social.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MediaModule,
    MarketplaceModule,
    SocialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
