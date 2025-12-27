import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { GatewayModule } from '@modules/gateway/gateway.module.js'; // Temporarily disabled
import { NotificationsModule } from '@modules/notifications/notifications.module.js';
import { QueueService } from './queue.service.js';
import {
  NotificationProcessor,
  PushProcessor,
  CleanupProcessor,
} from './processors/index.js';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from './interfaces/job-data.interface.js';

@Module({
  imports: [
    // Configure BullMQ with Redis connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: new URL(configService.get<string>('redis.url') || 'redis://localhost:6379').hostname,
          port: parseInt(
            new URL(configService.get<string>('redis.url') || 'redis://localhost:6379').port || '6379',
            10,
          ),
          password: new URL(configService.get<string>('redis.url') || 'redis://localhost:6379').password || undefined,
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),

    // Register queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.PUSH },
      { name: QUEUE_NAMES.CLEANUP },
    ),

    // Module dependencies
    // GatewayModule, // Temporarily disabled
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    QueueService,
    NotificationProcessor,
    PushProcessor,
    CleanupProcessor,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
