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
import type { ForumThread } from './forum-thread.entity.js';

@Entity('thread_replies')
export class ThreadReply extends BaseEntity {
  @Index()
  @Column({ name: 'thread_id', type: 'uuid' })
  threadId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount!: number;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  isEdited!: boolean;

  // Relations
  @ManyToOne('ForumThread', 'replies', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread!: ForumThread;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('ThreadReply', 'childReplies', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: ThreadReply;

  @OneToMany('ThreadReply', 'parent')
  childReplies?: ThreadReply[];

  // Virtual fields
  isLiked?: boolean;
}
