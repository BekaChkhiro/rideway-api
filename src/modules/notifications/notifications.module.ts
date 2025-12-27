import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatewayModule } from '@modules/gateway/gateway.module.js';
import { QueueModule } from '@modules/queue/queue.module.js';
import { DeviceToken } from '@database/index.js';
import { Notification, NotificationPreferences } from './entities/index.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { FCMService, DeviceTokensService } from './fcm/index.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreferences, DeviceToken]),
    GatewayModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    FCMService,
    DeviceTokensService,
  ],
  exports: [NotificationsService, FCMService, DeviceTokensService],
})
export class NotificationsModule {}
