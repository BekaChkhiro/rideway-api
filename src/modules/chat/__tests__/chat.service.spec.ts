import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from '../chat.service.js';
import {
  Conversation,
  ConversationType,
  ConversationParticipant,
  Message,
  MessageType,
} from '../entities/index.js';
import { User, UserBlock, UserProfile } from '@database/index.js';

describe('ChatService', () => {
  let service: ChatService;
  let mockConversationRepo: Record<string, Mock>;
  let mockParticipantRepo: Record<string, Mock>;
  let mockMessageRepo: Record<string, Mock>;
  let mockUserRepo: Record<string, Mock>;
  let mockBlockRepo: Record<string, Mock>;
  let mockDataSource: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;

  const userId1 = 'user-uuid-1234';
  const userId2 = 'user-uuid-5678';
  const conversationId = 'conv-uuid-1234';
  const messageId = 'msg-uuid-1234';

  const mockUser1: Partial<User> = {
    id: userId1,
    email: 'user1@example.com',
    isActive: true,
    profile: {
      id: 'profile-1',
      userId: userId1,
      username: 'user1',
      fullName: 'User One',
    } as UserProfile,
  };

  const mockUser2: Partial<User> = {
    id: userId2,
    email: 'user2@example.com',
    isActive: true,
    profile: {
      id: 'profile-2',
      userId: userId2,
      username: 'user2',
      fullName: 'User Two',
    } as UserProfile,
  };

  const mockConversation: Partial<Conversation> = {
    id: conversationId,
    type: ConversationType.PRIVATE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockParticipation1: Partial<ConversationParticipant> = {
    id: 'part-1',
    conversationId,
    userId: userId1,
    lastReadAt: undefined,
    isMuted: false,
    leftAt: undefined,
    conversation: mockConversation as Conversation,
  };

  const mockParticipation2: Partial<ConversationParticipant> = {
    id: 'part-2',
    conversationId,
    userId: userId2,
    lastReadAt: undefined,
    isMuted: false,
    leftAt: undefined,
    user: mockUser2 as User,
  };

  const mockMessage: Partial<Message> = {
    id: messageId,
    conversationId,
    senderId: userId1,
    content: 'Hello World',
    messageType: MessageType.TEXT,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender: mockUser1 as User,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConversationRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      }),
    };

    mockParticipantRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    };

    mockMessageRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
      }),
    };

    mockUserRepo = {
      findOne: vi.fn(),
    };

    mockBlockRepo = {
      findOne: vi.fn().mockResolvedValue(null), // No blocks by default
    };

    mockDataSource = {
      transaction: vi.fn().mockImplementation(async (callback) => {
        const manager = {
          create: vi.fn().mockImplementation((Entity, data) => ({
            id: 'new-uuid',
            ...data,
          })),
          save: vi.fn().mockImplementation((entity) =>
            Promise.resolve(entity),
          ),
          update: vi.fn().mockResolvedValue({ affected: 1 }),
        };
        return callback(manager);
      }),
    };

    mockRedisClient = {
      sismember: vi.fn().mockResolvedValue(0),
      del: vi.fn().mockResolvedValue(1),
    };

    mockRedisService = {
      getClient: vi.fn().mockReturnValue(mockRedisClient),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
    };

    service = new ChatService(
      mockConversationRepo as any,
      mockParticipantRepo as any,
      mockMessageRepo as any,
      mockUserRepo as any,
      mockBlockRepo as any,
      mockDataSource as any,
      mockRedisService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findOrCreateConversation', () => {
    it('should create a new conversation between two users', async () => {
      // Arrange
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findOrCreateConversation(userId1, userId2);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe(ConversationType.PRIVATE);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should return existing conversation if one exists', async () => {
      // Arrange
      mockUserRepo.findOne.mockResolvedValue(mockUser2);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockConversationRepo.createQueryBuilder.mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockConversation),
      });

      // Act
      const result = await service.findOrCreateConversation(userId1, userId2);

      // Assert
      expect(result).toEqual(mockConversation);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when creating conversation with self', async () => {
      // Act & Assert
      await expect(
        service.findOrCreateConversation(userId1, userId1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user is blocked', async () => {
      // Arrange
      mockBlockRepo.findOne.mockResolvedValue({
        id: 'block-1',
        blockerId: userId1,
        blockedId: userId2,
      } as UserBlock);

      // Act & Assert
      await expect(
        service.findOrCreateConversation(userId1, userId2),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when blocked by other user', async () => {
      // Arrange
      mockBlockRepo.findOne.mockResolvedValue({
        id: 'block-1',
        blockerId: userId2,
        blockedId: userId1,
      } as UserBlock);

      // Act & Assert
      await expect(
        service.findOrCreateConversation(userId1, userId2),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when participant does not exist', async () => {
      // Arrange
      mockUserRepo.findOne.mockResolvedValue(null);
      mockBlockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findOrCreateConversation(userId1, userId2),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendMessage', () => {
    it('should create and return a message', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(1); // Is participant
      mockParticipantRepo.find.mockResolvedValue([
        mockParticipation1,
        mockParticipation2,
      ]);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockMessageRepo.findOne.mockResolvedValue(mockMessage);

      // Act
      const result = await service.sendMessage(conversationId, userId1, {
        content: 'Hello World',
        messageType: MessageType.TEXT,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBe('Hello World');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not participant', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(0);

      // Act & Assert
      await expect(
        service.sendMessage(conversationId, userId1, {
          content: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if blocked by recipient', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(1);
      mockParticipantRepo.find.mockResolvedValue([
        mockParticipation1,
        mockParticipation2,
      ]);
      mockBlockRepo.findOne.mockResolvedValue({
        id: 'block-1',
        blockerId: userId2,
        blockedId: userId1,
      } as UserBlock);

      // Act & Assert
      await expect(
        service.sendMessage(conversationId, userId1, {
          content: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update conversation timestamp on message send', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(1);
      mockParticipantRepo.find.mockResolvedValue([mockParticipation1]);
      mockBlockRepo.findOne.mockResolvedValue(null);
      mockMessageRepo.findOne.mockResolvedValue(mockMessage);

      // Act
      await service.sendMessage(conversationId, userId1, {
        content: 'Hello',
      });

      // Assert
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should update lastReadAt timestamp', async () => {
      // Arrange
      mockParticipantRepo.findOne.mockResolvedValue(mockParticipation1);

      // Act
      await service.markAsRead(conversationId, userId1);

      // Assert
      expect(mockParticipantRepo.update).toHaveBeenCalledWith(
        mockParticipation1.id,
        expect.objectContaining({
          lastReadAt: expect.any(Date),
        }),
      );
    });

    it('should update lastReadAt to message timestamp if messageId provided', async () => {
      // Arrange
      const messageTime = new Date('2024-01-01');
      mockParticipantRepo.findOne.mockResolvedValue(mockParticipation1);
      mockMessageRepo.findOne.mockResolvedValue({
        ...mockMessage,
        createdAt: messageTime,
      });

      // Act
      await service.markAsRead(conversationId, userId1, messageId);

      // Assert
      expect(mockParticipantRepo.update).toHaveBeenCalledWith(
        mockParticipation1.id,
        expect.objectContaining({
          lastReadAt: messageTime,
        }),
      );
    });

    it('should throw ForbiddenException if not participant', async () => {
      // Arrange
      mockParticipantRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.markAsRead(conversationId, userId1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should invalidate unread cache after marking as read', async () => {
      // Arrange
      mockParticipantRepo.findOne.mockResolvedValue(mockParticipation1);
      mockParticipantRepo.find.mockResolvedValue([
        mockParticipation1,
        mockParticipation2,
      ]);

      // Act
      await service.markAsRead(conversationId, userId1);

      // Assert
      expect(mockRedisService.del).toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete message when sender deletes', async () => {
      // Arrange
      mockMessageRepo.findOne.mockResolvedValue(mockMessage);

      // Act
      await service.deleteMessage(messageId, userId1);

      // Assert
      expect(mockMessageRepo.softDelete).toHaveBeenCalledWith(messageId);
    });

    it('should throw NotFoundException if message not found', async () => {
      // Arrange
      mockMessageRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteMessage(messageId, userId1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if not the sender', async () => {
      // Arrange
      mockMessageRepo.findOne.mockResolvedValue(null); // Different senderId won't match

      // Act & Assert
      await expect(service.deleteMessage(messageId, userId2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('muteConversation', () => {
    it('should mute conversation', async () => {
      // Arrange
      mockParticipantRepo.findOne.mockResolvedValue(mockParticipation1);

      // Act
      await service.muteConversation(conversationId, userId1, true);

      // Assert
      expect(mockParticipantRepo.update).toHaveBeenCalledWith(
        mockParticipation1.id,
        { isMuted: true },
      );
    });

    it('should unmute conversation', async () => {
      // Arrange
      mockParticipantRepo.findOne.mockResolvedValue({
        ...mockParticipation1,
        isMuted: true,
      });

      // Act
      await service.muteConversation(conversationId, userId1, false);

      // Assert
      expect(mockParticipantRepo.update).toHaveBeenCalledWith(
        mockParticipation1.id,
        { isMuted: false },
      );
    });

    it('should throw ForbiddenException if not participant', async () => {
      // Arrange
      mockParticipantRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.muteConversation(conversationId, userId1, true),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return total unread count and per-conversation counts', async () => {
      // Arrange
      mockParticipantRepo.find.mockResolvedValue([
        { ...mockParticipation1, lastReadAt: new Date('2024-01-01') },
      ]);
      mockMessageRepo.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(5),
      });

      // Act
      const result = await service.getUnreadCount(userId1);

      // Assert
      expect(result).toHaveProperty('totalUnread');
      expect(result).toHaveProperty('conversationCounts');
      expect(result.totalUnread).toBe(5);
    });

    it('should count all messages for users who never read', async () => {
      // Arrange
      mockParticipantRepo.find.mockResolvedValue([
        { ...mockParticipation1, lastReadAt: undefined },
      ]);
      mockMessageRepo.count
        .mockResolvedValueOnce(10) // Total messages
        .mockResolvedValueOnce(3); // Own messages

      // Act
      const result = await service.getUnreadCount(userId1);

      // Assert
      expect(result.totalUnread).toBe(7); // 10 - 3 = 7 unread
    });
  });

  describe('isParticipant', () => {
    it('should return true if user is participant', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(1);

      // Act
      const result = await service.isParticipant(conversationId, userId1);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if user is not participant', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(0);

      // Act
      const result = await service.isParticipant(conversationId, userId1);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(1);
      mockMessageRepo.find.mockResolvedValue([mockMessage]);

      // Act
      const result = await service.getMessages(conversationId, userId1, {});

      // Assert
      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should throw ForbiddenException if not participant', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(0);

      // Act & Assert
      await expect(
        service.getMessages(conversationId, userId1, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should indicate hasMore when more messages exist', async () => {
      // Arrange
      mockParticipantRepo.count.mockResolvedValue(1);
      const manyMessages = Array(51)
        .fill(mockMessage)
        .map((m, i) => ({ ...m, id: `msg-${i}` }));
      mockMessageRepo.find.mockResolvedValue(manyMessages);

      // Act
      const result = await service.getMessages(conversationId, userId1, {
        limit: 50,
      });

      // Assert
      expect(result.hasMore).toBe(true);
      expect(result.messages).toHaveLength(50);
    });
  });

  describe('getOtherParticipantId', () => {
    it('should return other participant ID', async () => {
      // Arrange
      mockParticipantRepo.find.mockResolvedValue([
        mockParticipation1,
        mockParticipation2,
      ]);

      // Act
      const result = await service.getOtherParticipantId(conversationId, userId1);

      // Assert
      expect(result).toBe(userId2);
    });

    it('should return null if no other participant', async () => {
      // Arrange
      mockParticipantRepo.find.mockResolvedValue([mockParticipation1]);

      // Act
      const result = await service.getOtherParticipantId(conversationId, userId1);

      // Assert
      expect(result).toBeNull();
    });
  });
});
