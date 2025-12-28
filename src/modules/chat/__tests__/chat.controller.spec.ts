import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { ChatController } from '../chat.controller.js';
import { User, MessageType } from '@database/index.js';

describe('ChatController', () => {
  let controller: ChatController;
  let mockChatService: Record<string, Mock>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
  };

  const participantId = 'user-uuid-5678';
  const conversationId = 'conv-uuid-1234';
  const messageId = 'msg-uuid-1234';

  const mockConversation = {
    id: conversationId,
    participants: [
      { userId: mockUser.id, username: 'testuser', avatarUrl: null },
      { userId: participantId, username: 'other', avatarUrl: null },
    ],
    lastMessage: null,
    unreadCount: 0,
    isMuted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessage = {
    id: messageId,
    conversationId,
    senderId: mockUser.id,
    sender: {
      id: mockUser.id,
      profile: {
        username: 'testuser',
        avatarUrl: null,
      },
    },
    content: 'Hello!',
    messageType: MessageType.TEXT,
    mediaUrl: null,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockChatService = {
      getConversations: vi.fn().mockResolvedValue([mockConversation]),
      findOrCreateConversation: vi
        .fn()
        .mockResolvedValue({ id: conversationId }),
      getConversation: vi.fn().mockResolvedValue(mockConversation),
      getMessages: vi.fn().mockResolvedValue({
        messages: [mockMessage],
        total: 1,
        hasMore: false,
      }),
      sendMessage: vi.fn().mockResolvedValue(mockMessage),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      muteConversation: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      getUnreadCount: vi
        .fn()
        .mockResolvedValue({ total: 5, byConversation: {} }),
    };

    controller = new ChatController(mockChatService as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConversations', () => {
    it('should return list of conversations', async () => {
      const result = await controller.getConversations(mockUser as User);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(conversationId);
      expect(mockChatService.getConversations).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should return empty array if no conversations', async () => {
      mockChatService.getConversations.mockResolvedValue([]);

      const result = await controller.getConversations(mockUser as User);

      expect(result).toHaveLength(0);
    });
  });

  describe('createConversation', () => {
    it('should create or find existing conversation', async () => {
      const dto = { participantId };

      const result = await controller.createConversation(mockUser as User, dto);

      expect(result.id).toBe(conversationId);
      expect(mockChatService.findOrCreateConversation).toHaveBeenCalledWith(
        mockUser.id,
        participantId,
      );
      expect(mockChatService.getConversation).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
      );
    });
  });

  describe('getConversation', () => {
    it('should return conversation details', async () => {
      const result = await controller.getConversation(
        mockUser as User,
        conversationId,
      );

      expect(result.id).toBe(conversationId);
      expect(result.participants).toHaveLength(2);
      expect(mockChatService.getConversation).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
      );
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      const query = { limit: 20, offset: 0 };

      const result = await controller.getMessages(
        mockUser as User,
        conversationId,
        query,
      );

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        query,
      );
    });

    it('should pass cursor for pagination', async () => {
      const query = { limit: 20, before: 'cursor-id' };

      await controller.getMessages(mockUser as User, conversationId, query);

      expect(mockChatService.getMessages).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        query,
      );
    });
  });

  describe('sendMessage', () => {
    it('should send text message', async () => {
      const dto = { content: 'Hello!' };

      const result = await controller.sendMessage(
        mockUser as User,
        conversationId,
        dto,
      );

      expect(result.id).toBe(messageId);
      expect(result.content).toBe('Hello!');
      expect(result.senderId).toBe(mockUser.id);
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        dto,
      );
    });

    it('should send media message', async () => {
      const dto = {
        content: 'Check this out',
        messageType: MessageType.IMAGE,
        mediaUrl: 'https://example.com/image.jpg',
      };

      mockChatService.sendMessage.mockResolvedValue({
        ...mockMessage,
        ...dto,
      });

      const result = await controller.sendMessage(
        mockUser as User,
        conversationId,
        dto,
      );

      expect(result.messageType).toBe(MessageType.IMAGE);
      expect(result.mediaUrl).toBe(dto.mediaUrl);
    });

    it('should format sender info in response', async () => {
      const dto = { content: 'Hello!' };

      const result = await controller.sendMessage(
        mockUser as User,
        conversationId,
        dto,
      );

      expect(result.sender).toEqual({
        id: mockUser.id,
        username: 'testuser',
        avatarUrl: null,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark conversation as read', async () => {
      await controller.markAsRead(mockUser as User, conversationId);

      expect(mockChatService.markAsRead).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        undefined,
      );
    });

    it('should mark up to specific message as read', async () => {
      await controller.markAsRead(mockUser as User, conversationId, messageId);

      expect(mockChatService.markAsRead).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        messageId,
      );
    });
  });

  describe('muteConversation', () => {
    it('should mute conversation', async () => {
      await controller.muteConversation(mockUser as User, conversationId, {
        muted: true,
      });

      expect(mockChatService.muteConversation).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        true,
      );
    });

    it('should unmute conversation', async () => {
      await controller.muteConversation(mockUser as User, conversationId, {
        muted: false,
      });

      expect(mockChatService.muteConversation).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        false,
      );
    });
  });

  describe('deleteMessage', () => {
    it('should delete message', async () => {
      await controller.deleteMessage(mockUser as User, messageId);

      expect(mockChatService.deleteMessage).toHaveBeenCalledWith(
        messageId,
        mockUser.id,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message counts', async () => {
      const result = await controller.getUnreadCount(mockUser as User);

      expect(result.total).toBe(5);
      expect(mockChatService.getUnreadCount).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return zero when no unread messages', async () => {
      mockChatService.getUnreadCount.mockResolvedValue({
        total: 0,
        byConversation: {},
      });

      const result = await controller.getUnreadCount(mockUser as User);

      expect(result.total).toBe(0);
    });
  });
});
