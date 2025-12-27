import {
  Entity,
  Column,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { PostHashtag } from './post-hashtag.entity.js';

@Entity('hashtags')
export class Hashtag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ name: 'posts_count', type: 'int', default: 0 })
  postsCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany('PostHashtag', 'hashtag')
  postHashtags?: PostHashtag[];
}
