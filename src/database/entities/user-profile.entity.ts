import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity.js';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Index()
  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100, nullable: true })
  fullName?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ name: 'cover_url', type: 'varchar', length: 500, nullable: true })
  coverUrl?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
