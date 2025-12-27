import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '@database/entities/base.entity.js';
import { User } from '@database/entities/user.entity.js';
import { ListingCategory } from './listing-category.entity.js';
import { ListingImage } from './listing-image.entity.js';
import { ListingFavorite } from './listing-favorite.entity.js';

export enum ListingCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  USED = 'used',
}

export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
}

export enum ListingCurrency {
  GEL = 'GEL',
  USD = 'USD',
  EUR = 'EUR',
}

@Entity('listings')
export class Listing extends BaseEntity {
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
    default: ListingCurrency.GEL,
  })
  currency!: ListingCurrency;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  condition?: ListingCondition;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: ListingStatus.ACTIVE,
  })
  status!: ListingStatus;

  @Column({ name: 'views_count', type: 'int', default: 0 })
  viewsCount!: number;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => ListingCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: ListingCategory;

  @OneToMany(() => ListingImage, (image) => image.listing, { cascade: true })
  images?: ListingImage[];

  @OneToMany(() => ListingFavorite, (favorite) => favorite.listing)
  favorites?: ListingFavorite[];

  // Virtual field for checking if current user favorited
  isFavorited?: boolean;
}
