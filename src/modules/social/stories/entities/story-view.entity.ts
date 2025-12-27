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
import { User } from '@database/entities/user.entity.js';
import { Story } from './story.entity.js';

@Entity('story_views')
@Unique(['storyId', 'userId'])
export class StoryView {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'story_id', type: 'uuid' })
  storyId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'viewed_at' })
  viewedAt!: Date;

  @ManyToOne(() => Story, (story) => story.views, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story!: Story;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
