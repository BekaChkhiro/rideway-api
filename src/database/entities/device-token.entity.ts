import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './user.entity.js';

export enum DeviceType {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

@Entity('device_tokens')
@Unique(['userId', 'token'])
@Index('idx_device_tokens_user', ['userId'])
@Index('idx_device_tokens_active', ['userId', 'isActive'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token', type: 'varchar', length: 500 })
  token!: string;

  @Column({
    name: 'device_type',
    type: 'varchar',
    length: 20,
    enum: DeviceType,
  })
  deviceType!: DeviceType;

  @Column({ name: 'device_name', type: 'varchar', length: 100, nullable: true })
  deviceName?: string;

  @Column({ name: 'device_id', type: 'varchar', length: 100, nullable: true })
  deviceId?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
