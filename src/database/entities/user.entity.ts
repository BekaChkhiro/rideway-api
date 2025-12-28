import { Entity, Column, OneToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { UserRole } from './enums/user-role.enum.js';
import type { UserProfile } from './user-profile.entity.js';
import type { RefreshToken } from './refresh-token.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Index()
  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone?: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified!: boolean;

  @Column({ name: 'is_phone_verified', type: 'boolean', default: false })
  isPhoneVerified!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @OneToOne('UserProfile', 'user', { cascade: true })
  profile?: UserProfile;

  @OneToMany('RefreshToken', 'user')
  refreshTokens?: RefreshToken[];
}
