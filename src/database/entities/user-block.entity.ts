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

@Entity('user_blocks')
@Unique(['blockerId', 'blockedId'])
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'blocker_id', type: 'uuid' })
  blockerId!: string;

  @Index()
  @Column({ name: 'blocked_id', type: 'uuid' })
  blockedId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker!: User;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked!: User;
}
