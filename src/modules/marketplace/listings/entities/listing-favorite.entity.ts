import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '@database/entities/user.entity.js';
import { Listing } from './listing.entity.js';

@Entity('listing_favorites')
@Unique(['userId', 'listingId'])
export class ListingFavorite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Listing, (listing) => listing.favorites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}
