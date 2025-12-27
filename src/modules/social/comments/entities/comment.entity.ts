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
import type { Post } from '../../posts/entities/post.entity.js';
import type { CommentLike } from './comment-like.entity.js';

@Entity('comments')
export class Comment extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount!: number;

  @Column({ name: 'replies_count', type: 'int', default: 0 })
  repliesCount!: number;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  isEdited!: boolean;

  // Relations
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('Post', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @ManyToOne('Comment', 'replies', { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Comment;

  @OneToMany('Comment', 'parent')
  replies?: Comment[];

  @OneToMany('CommentLike', 'comment')
  likes?: CommentLike[];

  // Virtual fields
  isLiked?: boolean;
}
