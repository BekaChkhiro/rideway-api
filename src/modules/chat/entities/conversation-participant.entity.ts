import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '@database/entities/user.entity.js';
import { Conversation } from './conversation.entity.js';

@Entity('conversation_participants')
@Unique(['conversationId', 'userId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'last_read_at', type: 'timestamp', nullable: true })
  lastReadAt?: Date;

  @Column({ name: 'is_muted', type: 'boolean', default: false })
  isMuted!: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamp', nullable: true })
  leftAt?: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
