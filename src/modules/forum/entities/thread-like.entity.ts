import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import type { User } from '@database/entities/user.entity.js';
import type { ForumThread } from './forum-thread.entity.js';

@Entity('thread_likes')
@Unique(['userId', 'threadId'])
export class ThreadLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'thread_id', type: 'uuid' })
  threadId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('ForumThread', 'likes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread!: ForumThread;
}
