import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/entities/base.entity.js';
import type { User } from '@database/entities/user.entity.js';
import type { PartsCategory } from './parts-category.entity.js';
import type { PartImage } from './part-image.entity.js';

export enum PartCondition {
  NEW = 'new',
  USED = 'used',
  REFURBISHED = 'refurbished',
}

export enum PartStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
}

export enum PartCurrency {
  GEL = 'GEL',
  USD = 'USD',
  EUR = 'EUR',
}

@Entity('parts')
export class Part extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({
    type: 'varchar',
    length: 3,
    default: PartCurrency.GEL,
  })
  currency!: PartCurrency;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  condition?: PartCondition;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string;

  @Column({ name: 'part_number', type: 'varchar', length: 100, nullable: true })
  partNumber?: string;

  @Column({ type: 'jsonb', nullable: true })
  compatibility?: string[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: PartStatus.ACTIVE,
  })
  status!: PartStatus;

  @Column({ name: 'views_count', type: 'int', default: 0 })
  viewsCount!: number;

  // Relations
  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('PartsCategory', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: PartsCategory;

  @OneToMany('PartImage', 'part', { cascade: true })
  images?: PartImage[];
}
