import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MediaModule } from '@modules/media/media.module.js';

// Posts Entities
import {
  Post,
  PostImage,
  PostLike,
  Hashtag,
  PostHashtag,
  PostMention,
} from './posts/entities/index.js';

// Stories Entities
import { Story, StoryView } from './stories/entities/index.js';

// Shared Entities
import { UserFollow } from '@database/entities/user-follow.entity.js';
import { UserBlock } from '@database/entities/user-block.entity.js';
import { UserProfile } from '@database/entities/user-profile.entity.js';

// Services
import { PostsService } from './posts/posts.service.js';
import { StoriesService } from './stories/stories.service.js';

// Controllers
import { PostsController } from './posts/posts.controller.js';
import { StoriesController } from './stories/stories.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Posts
      Post,
      PostImage,
      PostLike,
      Hashtag,
      PostHashtag,
      PostMention,
      // Stories
      Story,
      StoryView,
      // Shared
      UserFollow,
      UserBlock,
      UserProfile,
    ]),
    ScheduleModule.forRoot(),
    MediaModule,
  ],
  controllers: [PostsController, StoriesController],
  providers: [PostsService, StoriesService],
  exports: [PostsService, StoriesService],
})
export class SocialModule {}
