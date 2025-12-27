import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { MarketplaceModule } from './modules/marketplace/marketplace.module.js';
import { SocialModule } from './modules/social/social.module.js';
import { ForumModule } from './modules/forum/forum.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { GatewayModule } from './modules/gateway/gateway.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { QueueModule } from './modules/queue/queue.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    EmailModule,
    HealthModule,
    AuthModule,
    MediaModule,
    // UsersModule, // Depends on MediaModule - testing MediaModule first
    // MarketplaceModule, // Depends on MediaModule
    // SocialModule, // Depends on MediaModule
    ForumModule,
    ServicesModule,
    GatewayModule,
    ChatModule,
    NotificationsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
