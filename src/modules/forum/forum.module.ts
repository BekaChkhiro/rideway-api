import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@redis/redis.module.js';
import { ForumCategory } from './entities/forum-category.entity.js';
import { ForumThread } from './entities/forum-thread.entity.js';
import { ThreadReply } from './entities/thread-reply.entity.js';
import { ThreadLike } from './entities/thread-like.entity.js';
import { ThreadSubscription } from './entities/thread-subscription.entity.js';
import { ReplyLike } from './entities/reply-like.entity.js';
import { ForumCategoriesService } from './forum-categories.service.js';
import { ForumThreadsService } from './forum-threads.service.js';
import { ForumCategoriesController } from './forum-categories.controller.js';
import {
  ForumThreadsController,
  ForumRepliesController,
} from './forum-threads.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForumCategory,
      ForumThread,
      ThreadReply,
      ThreadLike,
      ThreadSubscription,
      ReplyLike,
    ]),
    RedisModule,
  ],
  controllers: [
    ForumCategoriesController,
    ForumThreadsController,
    ForumRepliesController,
  ],
  providers: [ForumCategoriesService, ForumThreadsService],
  exports: [ForumCategoriesService, ForumThreadsService],
})
export class ForumModule {}
