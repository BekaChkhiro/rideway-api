import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/entities/base.entity.js';
import type { User } from '@database/entities/user.entity.js';
import type { ForumCategory } from './forum-category.entity.js';
import type { ThreadReply } from './thread-reply.entity.js';
import type { ThreadLike } from './thread-like.entity.js';
import type { ThreadSubscription } from './thread-subscription.entity.js';

@Entity('forum_threads')
export class ForumThread extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'views_count', type: 'int', default: 0 })
  viewsCount!: number;

  @Column({ name: 'replies_count', type: 'int', default: 0 })
  repliesCount!: number;

  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount!: number;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked!: boolean;

  @Index()
  @Column({ name: 'last_reply_at', type: 'timestamp', nullable: true })
  lastReplyAt?: Date;

  @Column({ name: 'last_reply_user_id', type: 'uuid', nullable: true })
  lastReplyUserId?: string;

  // Relations
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('ForumCategory', 'threads', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category!: ForumCategory;

  @ManyToOne('User', { nullable: true })
  @JoinColumn({ name: 'last_reply_user_id' })
  lastReplyUser?: User;

  @OneToMany('ThreadReply', 'thread')
  replies?: ThreadReply[];

  @OneToMany('ThreadLike', 'thread')
  likes?: ThreadLike[];

  @OneToMany('ThreadSubscription', 'thread')
  subscriptions?: ThreadSubscription[];

  // Virtual fields
  isLiked?: boolean;
  isSubscribed?: boolean;
}
