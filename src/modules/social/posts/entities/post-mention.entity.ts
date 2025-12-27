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
import type { Post } from './post.entity.js';

@Entity('post_mentions')
@Unique(['postId', 'mentionedUserId'])
export class PostMention {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string;

  @Index()
  @Column({ name: 'mentioned_user_id', type: 'uuid' })
  mentionedUserId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('Post', 'mentions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentioned_user_id' })
  mentionedUser!: User;
}
