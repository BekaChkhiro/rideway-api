import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan } from 'typeorm';
import { RedisService } from '@redis/redis.service.js';
import { User, UserBlock } from '@database/index.js';
import {
  Conversation,
  ConversationType,
  ConversationParticipant,
  Message,
  MessageType,
} from './entities/index.js';
import {
  SendMessageDto,
  MessageQueryDto,
} from './dto/index.js';
import {
  ConversationResponse,
  ConversationListResponse,
  MessageResponse,
  MessagesListResponse,
  UnreadCountResponse,
  ParticipantInfo,
} from './interfaces/index.js';

const REDIS_KEYS = {
  UNREAD_COUNT: 'chat:unread:', // chat:unread:{userId} -> total unread
  CONVERSATION_UNREAD: 'chat:conv:unread:', // chat:conv:unread:{conversationId}:{userId} -> count
} as const;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  /**
   * Find existing conversation or create new one between two users
   */
  async findOrCreateConversation(
    userId: string,
    participantId: string,
  ): Promise<Conversation> {
    if (userId === participantId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    // Check if blocked
    await this.checkBlocking(userId, participantId);

    // Check if participant exists
    const participant = await this.userRepository.findOne({
      where: { id: participantId, isActive: true },
    });
    if (!participant) {
      throw new NotFoundException('User not found');
    }

    // Try to find existing conversation
    const existing = await this.findExistingConversation(userId, participantId);
    if (existing) {
      return existing;
    }

    // Create new conversation
    return this.dataSource.transaction(async (manager) => {
      const conversation = manager.create(Conversation, {
        type: ConversationType.PRIVATE,
      });
      await manager.save(conversation);

      // Add both participants
      const participants = [
        manager.create(ConversationParticipant, {
          conversationId: conversation.id,
          userId,
        }),
        manager.create(ConversationParticipant, {
          conversationId: conversation.id,
          userId: participantId,
        }),
      ];
      await manager.save(participants);

      this.logger.log(
        `Created conversation ${conversation.id} between ${userId} and ${participantId}`,
      );

      return conversation;
    });
  }

  /**
   * Get all conversations for a user with last message
   */
  async getConversations(userId: string): Promise<ConversationListResponse> {
    const participations = await this.participantRepository.find({
      where: { userId, leftAt: undefined },
      relations: ['conversation', 'conversation.participants', 'conversation.participants.user', 'conversation.participants.user.profile'],
      order: { conversation: { updatedAt: 'DESC' } },
    });

    const conversations: ConversationResponse[] = [];

    for (const participation of participations) {
      const conversation = participation.conversation;

      // Find the other participant
      const otherParticipant = conversation.participants.find(
        (p) => p.userId !== userId,
      );
      if (!otherParticipant) continue;

      // Get last message
      const lastMessage = await this.messageRepository.findOne({
        where: { conversationId: conversation.id },
        order: { createdAt: 'DESC' },
      });

      // Get unread count
      const unreadCount = await this.getConversationUnreadCount(
        conversation.id,
        userId,
        participation.lastReadAt,
      );

      // Check online status
      const isOnline = await this.isUserOnline(otherParticipant.userId);
      const lastSeen = await this.getLastSeen(otherParticipant.userId);

      const participantInfo: ParticipantInfo = {
        id: otherParticipant.userId,
        username: otherParticipant.user?.profile?.username || 'Unknown',
        fullName: otherParticipant.user?.profile?.fullName,
        avatarUrl: otherParticipant.user?.profile?.avatarUrl,
        isOnline,
        lastSeen: lastSeen || undefined,
      };

      conversations.push({
        id: conversation.id,
        type: conversation.type,
        participant: participantInfo,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              messageType: lastMessage.messageType,
              createdAt: lastMessage.createdAt,
              isRead: participation.lastReadAt
                ? lastMessage.createdAt <= participation.lastReadAt
                : false,
              senderId: lastMessage.senderId,
            }
          : undefined,
        unreadCount,
        isMuted: participation.isMuted,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });
    }

    return {
      conversations,
      total: conversations.length,
    };
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationResponse> {
    const participation = await this.participantRepository.findOne({
      where: { conversationId, userId, leftAt: undefined },
      relations: ['conversation', 'conversation.participants', 'conversation.participants.user', 'conversation.participants.user.profile'],
    });

    if (!participation) {
      throw new NotFoundException('Conversation not found');
    }

    const conversation = participation.conversation;
    const otherParticipant = conversation.participants.find(
      (p) => p.userId !== userId,
    );

    if (!otherParticipant) {
      throw new NotFoundException('Conversation not found');
    }

    const lastMessage = await this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });

    const unreadCount = await this.getConversationUnreadCount(
      conversationId,
      userId,
      participation.lastReadAt,
    );

    const isOnline = await this.isUserOnline(otherParticipant.userId);
    const lastSeen = await this.getLastSeen(otherParticipant.userId);

    return {
      id: conversation.id,
      type: conversation.type,
      participant: {
        id: otherParticipant.userId,
        username: otherParticipant.user?.profile?.username || 'Unknown',
        fullName: otherParticipant.user?.profile?.fullName,
        avatarUrl: otherParticipant.user?.profile?.avatarUrl,
        isOnline,
        lastSeen: lastSeen || undefined,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            messageType: lastMessage.messageType,
            createdAt: lastMessage.createdAt,
            isRead: participation.lastReadAt
              ? lastMessage.createdAt <= participation.lastReadAt
              : false,
            senderId: lastMessage.senderId,
          }
        : undefined,
      unreadCount,
      isMuted: participation.isMuted,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * Get paginated messages for a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    query: MessageQueryDto,
  ): Promise<MessagesListResponse> {
    // Verify user is participant
    const isParticipant = await this.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const limit = query.limit || 50;
    const whereConditions: Record<string, unknown> = { conversationId };

    if (query.before) {
      whereConditions['createdAt'] = LessThan(new Date(query.before));
    } else if (query.after) {
      whereConditions['createdAt'] = MoreThan(new Date(query.after));
    }

    const messages = await this.messageRepository.find({
      where: whereConditions,
      relations: ['sender', 'sender.profile'],
      order: { createdAt: 'DESC' },
      take: limit + 1, // Fetch one extra to check if there are more
    });

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    const messageResponses: MessageResponse[] = messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      sender: msg.sender
        ? {
            id: msg.sender.id,
            username: msg.sender.profile?.username || 'Unknown',
            avatarUrl: msg.sender.profile?.avatarUrl,
          }
        : undefined,
      content: msg.content,
      messageType: msg.messageType,
      mediaUrl: msg.mediaUrl,
      isEdited: msg.isEdited,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    return {
      messages: messageResponses.reverse(), // Return in chronological order
      hasMore,
    };
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ): Promise<Message> {
    // Verify sender is participant
    const isParticipant = await this.isParticipant(conversationId, senderId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // Get other participant to check blocking
    const participants = await this.participantRepository.find({
      where: { conversationId, leftAt: undefined },
    });
    const otherParticipant = participants.find((p) => p.userId !== senderId);
    if (otherParticipant) {
      await this.checkBlocking(senderId, otherParticipant.userId);
    }

    // Create message
    const message = await this.dataSource.transaction(async (manager) => {
      const msg = manager.create(Message, {
        conversationId,
        senderId,
        content: dto.content,
        messageType: dto.messageType || MessageType.TEXT,
        mediaUrl: dto.mediaUrl,
      });
      await manager.save(msg);

      // Update conversation's updatedAt
      await manager.update(Conversation, conversationId, {
        updatedAt: new Date(),
      });

      return msg;
    });

    // Invalidate unread count cache
    await this.invalidateUnreadCache(conversationId, senderId);

    this.logger.debug(
      `Message ${message.id} sent in conversation ${conversationId} by ${senderId}`,
    );

    // Return message with sender info
    return this.messageRepository.findOne({
      where: { id: message.id },
      relations: ['sender', 'sender.profile'],
    }) as Promise<Message>;
  }

  /**
   * Mark messages as read up to a specific message
   */
  async markAsRead(
    conversationId: string,
    userId: string,
    messageId?: string,
  ): Promise<void> {
    const participation = await this.participantRepository.findOne({
      where: { conversationId, userId, leftAt: undefined },
    });

    if (!participation) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    let readAt = new Date();

    if (messageId) {
      const message = await this.messageRepository.findOne({
        where: { id: messageId, conversationId },
      });
      if (message) {
        readAt = message.createdAt;
      }
    }

    await this.participantRepository.update(participation.id, {
      lastReadAt: readAt,
    });

    // Invalidate cache
    await this.invalidateUnreadCache(conversationId, userId);

    this.logger.debug(
      `User ${userId} marked conversation ${conversationId} as read`,
    );
  }

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, senderId: userId },
    });

    if (!message) {
      throw new NotFoundException('Message not found or you are not the sender');
    }

    await this.messageRepository.softDelete(messageId);
    this.logger.debug(`Message ${messageId} deleted by ${userId}`);
  }

  /**
   * Toggle mute status for a conversation
   */
  async muteConversation(
    conversationId: string,
    userId: string,
    muted: boolean,
  ): Promise<void> {
    const participation = await this.participantRepository.findOne({
      where: { conversationId, userId, leftAt: undefined },
    });

    if (!participation) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    await this.participantRepository.update(participation.id, {
      isMuted: muted,
    });

    this.logger.debug(
      `User ${userId} ${muted ? 'muted' : 'unmuted'} conversation ${conversationId}`,
    );
  }

  /**
   * Get total unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const participations = await this.participantRepository.find({
      where: { userId, leftAt: undefined },
    });

    let totalUnread = 0;
    const conversationCounts: Record<string, number> = {};

    for (const participation of participations) {
      const count = await this.getConversationUnreadCount(
        participation.conversationId,
        userId,
        participation.lastReadAt,
      );
      conversationCounts[participation.conversationId] = count;
      totalUnread += count;
    }

    return { totalUnread, conversationCounts };
  }

  /**
   * Check if user is participant in conversation
   */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const count = await this.participantRepository.count({
      where: { conversationId, userId, leftAt: undefined },
    });
    return count > 0;
  }

  /**
   * Get other participant's ID in a private conversation
   */
  async getOtherParticipantId(
    conversationId: string,
    userId: string,
  ): Promise<string | null> {
    const participants = await this.participantRepository.find({
      where: { conversationId, leftAt: undefined },
    });
    const other = participants.find((p) => p.userId !== userId);
    return other?.userId || null;
  }

  // Private helper methods

  private async findExistingConversation(
    userId1: string,
    userId2: string,
  ): Promise<Conversation | null> {
    const result = await this.conversationRepository
      .createQueryBuilder('c')
      .innerJoin('c.participants', 'p1', 'p1.userId = :userId1', { userId1 })
      .innerJoin('c.participants', 'p2', 'p2.userId = :userId2', { userId2 })
      .where('c.type = :type', { type: ConversationType.PRIVATE })
      .andWhere('p1.leftAt IS NULL')
      .andWhere('p2.leftAt IS NULL')
      .getOne();

    return result;
  }

  private async checkBlocking(userId: string, targetId: string): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: [
        { blockerId: userId, blockedId: targetId },
        { blockerId: targetId, blockedId: userId },
      ],
    });

    if (block) {
      if (block.blockerId === userId) {
        throw new ForbiddenException('You have blocked this user');
      } else {
        throw new ForbiddenException('You cannot message this user');
      }
    }
  }

  private async getConversationUnreadCount(
    conversationId: string,
    userId: string,
    lastReadAt?: Date,
  ): Promise<number> {
    if (!lastReadAt) {
      // Count all messages not sent by user
      return this.messageRepository.count({
        where: {
          conversationId,
        },
      }).then((total) =>
        this.messageRepository.count({
          where: { conversationId, senderId: userId },
        }).then((own) => total - own)
      );
    }

    return this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.createdAt > :lastReadAt', { lastReadAt })
      .andWhere('m.senderId != :userId', { userId })
      .getCount();
  }

  private async invalidateUnreadCache(
    conversationId: string,
    excludeUserId: string,
  ): Promise<void> {
    const participants = await this.participantRepository.find({
      where: { conversationId, leftAt: undefined },
    });

    for (const p of participants) {
      if (p.userId !== excludeUserId) {
        await this.redisService.del(`${REDIS_KEYS.UNREAD_COUNT}${p.userId}`);
        await this.redisService.del(
          `${REDIS_KEYS.CONVERSATION_UNREAD}${conversationId}:${p.userId}`,
        );
      }
    }
  }

  private async isUserOnline(userId: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    const result = await redis.sismember('online:users', userId);
    return result === 1;
  }

  private async getLastSeen(userId: string): Promise<Date | null> {
    const timestamp = await this.redisService.get(`user:lastseen:${userId}`);
    return timestamp ? new Date(parseInt(timestamp, 10)) : null;
  }
}
