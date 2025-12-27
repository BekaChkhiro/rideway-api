import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '@database/entities/user.entity.js';

@Entity('notification_preferences')
export class NotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  // Global settings
  @Column({ name: 'push_enabled', type: 'boolean', default: true })
  pushEnabled!: boolean;

  @Column({ name: 'email_enabled', type: 'boolean', default: true })
  emailEnabled!: boolean;

  // Granular settings - Social
  @Column({ name: 'new_follower', type: 'boolean', default: true })
  newFollower!: boolean;

  @Column({ name: 'post_like', type: 'boolean', default: true })
  postLike!: boolean;

  @Column({ name: 'post_comment', type: 'boolean', default: true })
  postComment!: boolean;

  @Column({ name: 'comment_reply', type: 'boolean', default: true })
  commentReply!: boolean;

  // Chat
  @Column({ name: 'new_message', type: 'boolean', default: true })
  newMessage!: boolean;

  // Forum
  @Column({ name: 'thread_reply', type: 'boolean', default: true })
  threadReply!: boolean;

  // Marketplace
  @Column({ name: 'listing_inquiry', type: 'boolean', default: true })
  listingInquiry!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
