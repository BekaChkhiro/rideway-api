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
import type { PostImage } from './post-image.entity.js';
import type { PostLike } from './post-like.entity.js';
import type { PostHashtag } from './post-hashtag.entity.js';
import type { PostMention } from './post-mention.entity.js';

export enum PostVisibility {
  PUBLIC = 'public',
  FOLLOWERS = 'followers',
  PRIVATE = 'private',
}

@Entity('posts')
export class Post extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: PostVisibility.PUBLIC,
  })
  visibility!: PostVisibility;

  @Column({ name: 'likes_count', type: 'int', default: 0 })
  likesCount!: number;

  @Column({ name: 'comments_count', type: 'int', default: 0 })
  commentsCount!: number;

  @Column({ name: 'shares_count', type: 'int', default: 0 })
  sharesCount!: number;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  isEdited!: boolean;

  @Index()
  @Column({ name: 'original_post_id', type: 'uuid', nullable: true })
  originalPostId?: string;

  // Relations
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('Post', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'original_post_id' })
  originalPost?: Post;

  @OneToMany('PostImage', 'post', { cascade: true })
  images?: PostImage[];

  @OneToMany('PostLike', 'post')
  likes?: PostLike[];

  @OneToMany('PostHashtag', 'post', { cascade: true })
  postHashtags?: PostHashtag[];

  @OneToMany('PostMention', 'post', { cascade: true })
  mentions?: PostMention[];

  // Virtual fields
  isLiked?: boolean;
  isReposted?: boolean;
}
