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
import { ThreadReply } from './thread-reply.entity.js';

@Entity('reply_likes')
@Unique(['userId', 'replyId'])
export class ReplyLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'reply_id', type: 'uuid' })
  replyId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => ThreadReply, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reply_id' })
  reply!: ThreadReply;
}
