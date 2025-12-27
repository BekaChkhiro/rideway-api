import {
  Entity,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ConversationParticipant } from './conversation-participant.entity.js';
import type { Message } from './message.entity.js';

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ConversationType.PRIVATE,
  })
  type!: ConversationType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany('ConversationParticipant', 'conversation')
  participants!: ConversationParticipant[];

  @OneToMany('Message', 'conversation')
  messages!: Message[];
}
