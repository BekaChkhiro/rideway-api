import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { User } from './user.entity.js';

@Entity('user_activity')
export class UserActivity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'last_seen_at', type: 'timestamp', default: () => 'NOW()' })
  lastSeenAt!: Date;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline!: boolean;

  @Column({ name: 'appear_offline', type: 'boolean', default: false })
  appearOffline!: boolean;

  @Column({ name: 'show_last_seen', type: 'boolean', default: true })
  showLastSeen!: boolean;

  @Column({ name: 'active_connections', type: 'int', default: 0 })
  activeConnections!: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
