import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import type { User } from '@database/entities/user.entity.js';
import type { StoryView } from './story-view.entity.js';

export enum StoryMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'media_url', type: 'varchar', length: 500 })
  mediaUrl!: string;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailUrl?: string;

  @Column({
    name: 'media_type',
    type: 'varchar',
    length: 10,
    default: StoryMediaType.IMAGE,
  })
  mediaType!: StoryMediaType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  caption?: string;

  @Column({ name: 'views_count', type: 'int', default: 0 })
  viewsCount!: number;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany('StoryView', 'story')
  views?: StoryView[];

  // Virtual fields
  hasViewed?: boolean;
}
