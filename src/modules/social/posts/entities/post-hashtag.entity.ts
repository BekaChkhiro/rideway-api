import {
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
} from 'typeorm';
import type { Post } from './post.entity.js';
import type { Hashtag } from './hashtag.entity.js';

@Entity('post_hashtags')
export class PostHashtag {
  @PrimaryColumn({ name: 'post_id', type: 'uuid' })
  postId!: string;

  @PrimaryColumn({ name: 'hashtag_id', type: 'uuid' })
  hashtagId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('Post', 'postHashtags', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @ManyToOne('Hashtag', 'postHashtags', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hashtag_id' })
  hashtag!: Hashtag;
}
