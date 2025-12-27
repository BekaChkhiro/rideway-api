import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import type { User } from '@database/entities/user.entity.js';
import type { ServiceCategory } from './service-category.entity.js';
import type { ServiceImage } from './service-image.entity.js';
import type { ServiceReview } from './service-review.entity.js';

export enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

interface WorkingHours {
  open: string;
  close: string;
}

interface WeeklyWorkingHours {
  mon?: WorkingHours;
  tue?: WorkingHours;
  wed?: WorkingHours;
  thu?: WorkingHours;
  fri?: WorkingHours;
  sat?: WorkingHours;
  sun?: WorkingHours;
}

@Entity('services')
@Index(['latitude', 'longitude'])
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website?: string;

  @Column({ name: 'working_hours', type: 'jsonb', nullable: true })
  workingHours?: WeeklyWorkingHours;

  @Index()
  @Column({
    name: 'rating_avg',
    type: 'decimal',
    precision: 2,
    scale: 1,
    default: 0,
  })
  ratingAvg!: number;

  @Column({ name: 'reviews_count', type: 'int', default: 0 })
  reviewsCount!: number;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.ACTIVE,
  })
  status!: ServiceStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Relations
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne('ServiceCategory', 'services')
  @JoinColumn({ name: 'category_id' })
  category?: ServiceCategory;

  @OneToMany('ServiceImage', 'service')
  images?: ServiceImage[];

  @OneToMany('ServiceReview', 'service')
  reviews?: ServiceReview[];

  // Virtual fields
  isOwner?: boolean;
}
