import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '@database/entities/user.entity.js';
import { Conversation } from './conversation.entity.js';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId?: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({
    name: 'message_type',
    type: 'varchar',
    length: 20,
    default: MessageType.TEXT,
  })
  messageType!: MessageType;

  @Column({ name: 'media_url', type: 'varchar', length: 500, nullable: true })
  mediaUrl?: string;

  @Column({ name: 'is_edited', type: 'boolean', default: false })
  isEdited!: boolean;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender?: User;
}
