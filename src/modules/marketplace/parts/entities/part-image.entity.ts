import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Part } from './part.entity.js';

@Entity('part_images')
export class PartImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailUrl?: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Part, (part) => part.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'part_id' })
  part!: Part;
}
