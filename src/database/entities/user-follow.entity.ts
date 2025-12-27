import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import type { User } from './user.entity.js';

@Entity('user_follows')
@Unique(['followerId', 'followingId'])
export class UserFollow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'follower_id', type: 'uuid' })
  followerId!: string;

  @Index()
  @Column({ name: 'following_id', type: 'uuid' })
  followingId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower!: User;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'following_id' })
  following!: User;
}
