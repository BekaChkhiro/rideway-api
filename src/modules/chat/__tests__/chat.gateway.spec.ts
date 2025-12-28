import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { ChatGateway } from '../chat.gateway.js';
import { ChatService } from '../chat.service.js';
import { GatewayService } from '@modules/gateway/gateway.service.js';
import {
  AuthenticatedSocket,
  SocketUser,
} from '@modules/gateway/interfaces/index.js';
import { Message, MessageType } from '../entities/index.js';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockChatService: Record<string, Mock>;
  let mockGatewayService: Record<string, Mock>;
  let mockServer: Partial<Server>;

  const mockUser: SocketUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    username: 'testuser',
  };

  const mockUser2: SocketUser = {
    id: 'user-uuid-5678',
    email: 'test2@example.com',
    username: 'testuser2',
  };

  const conversationId = 'conv-uuid-1234';
  const messageId = 'msg-uuid-1234';

  const mockMessage: Partial<Message> = {
    id: messageId,
    conversationId,
    senderId: mockUser.id,
    content: 'Hello World',
    messageType: MessageType.TEXT,
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockChatService = {
      isParticipant: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue(mockMessage),
      markAsRead: vi.fn().mockResolvedValue(undefined),
      getOtherParticipantId: vi.fn().mockResolvedValue(mockUser2.id),
    };

    mockGatewayService = {
      setTyping: vi.fn().mockResolvedValue(undefined),
      isUserOnline: vi.fn().mockResolvedValue(false),
      getRoomMembers: vi.fn().mockReturnValue([]),
      getUserSocket: vi.fn().mockResolvedValue(null),
      emitToUser: vi.fn(),
    };

    mockServer = {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
      emit: vi.fn(),
    };

    gateway = new ChatGateway(
      mockChatService as any,
      mockGatewayService as any,
    );

    (gateway as any).server = mockServer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleJoinConversation', () => {
    it('should allow participant to join conversation room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockChatService.isParticipant.mockResolvedValue(true);

      // Act
      const result = await gateway.handleJoinConversation(
        mockSocket,
        conversationId,
      );

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockSocket.join).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
      );
      expect(mockChatService.isParticipant).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
      );
    });

    it('should reject non-participant from joining', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockChatService.isParticipant.mockResolvedValue(false);

      // Act
      const result = await gateway.handleJoinConversation(
        mockSocket,
        conversationId,
      );

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Not a participant of this conversation',
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveConversation', () => {
    it('should allow user to leave conversation room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);

      // Act
      const result = await gateway.handleLeaveConversation(
        mockSocket,
        conversationId,
      );

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockSocket.leave).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
      );
    });
  });

  describe('handleSendMessage', () => {
    it('should send message and broadcast to room participants', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const emitMock = vi.fn();
      (mockServer.to as Mock).mockReturnValue({ emit: emitMock });

      // Act
      const result = await gateway.handleSendMessage(mockSocket, {
        conversationId,
        content: 'Hello World',
      });

      // Assert
      expect(result).toEqual({ success: true, messageId });
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        expect.objectContaining({ content: 'Hello World' }),
      );
      expect(mockServer.to).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
      );
      expect(emitMock).toHaveBeenCalledWith(
        'message:new',
        expect.objectContaining({
          id: messageId,
          conversationId,
          content: 'Hello World',
        }),
      );
    });

    it('should handle send message error gracefully', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockChatService.sendMessage.mockRejectedValue(new Error('Blocked user'));

      // Act
      const result = await gateway.handleSendMessage(mockSocket, {
        conversationId,
        content: 'Hello',
      });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Blocked user',
      });
    });

    it('should notify offline recipient', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockGatewayService.isUserOnline.mockResolvedValue(false);

      // Act
      await gateway.handleSendMessage(mockSocket, {
        conversationId,
        content: 'Hello',
      });

      // Assert
      expect(mockChatService.getOtherParticipantId).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
      );
    });

    it('should send in-app notification if user online but not in room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockGatewayService.isUserOnline.mockResolvedValue(true);
      mockGatewayService.getRoomMembers.mockReturnValue(['socket-1']); // User not in this list
      mockGatewayService.getUserSocket.mockResolvedValue('socket-other');

      // Act
      await gateway.handleSendMessage(mockSocket, {
        conversationId,
        content: 'Hello',
      });

      // Assert
      expect(mockGatewayService.emitToUser).toHaveBeenCalledWith(
        mockUser2.id,
        'notification:new',
        expect.objectContaining({
          type: 'new_message',
        }),
      );
    });
  });

  describe('handleMessageRead', () => {
    it('should mark message as read and emit read receipt', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const toMock = vi.fn().mockReturnValue({ emit: vi.fn() });
      mockSocket.to = toMock;

      // Act
      const result = await gateway.handleMessageRead(mockSocket, {
        conversationId,
        messageId,
      });

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockChatService.markAsRead).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        messageId,
      );
      expect(toMock).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('should emit read receipt to room excluding sender', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });
      mockSocket.to = toMock;

      // Act
      await gateway.handleMessageRead(mockSocket, {
        conversationId,
        messageId,
      });

      // Assert
      expect(emitMock).toHaveBeenCalledWith('message:read', {
        userId: mockUser.id,
        messageId,
      });
    });

    it('should handle read error gracefully', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockChatService.markAsRead.mockRejectedValue(
        new Error('Not participant'),
      );

      // Act
      const result = await gateway.handleMessageRead(mockSocket, {
        conversationId,
        messageId,
      });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Not participant',
      });
    });
  });

  describe('handleTypingStart', () => {
    it('should set typing state and emit to room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });
      mockSocket.to = toMock;
      mockChatService.isParticipant.mockResolvedValue(true);

      // Act
      await gateway.handleTypingStart(mockSocket, conversationId);

      // Assert
      expect(mockGatewayService.setTyping).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        true,
      );
      expect(toMock).toHaveBeenCalledWith(`conversation:${conversationId}`);
      expect(emitMock).toHaveBeenCalledWith('typing:update', {
        conversationId,
        userId: mockUser.id,
        isTyping: true,
      });
    });

    it('should emit typing to room excluding sender', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });
      mockSocket.to = toMock;
      mockChatService.isParticipant.mockResolvedValue(true);

      // Act
      await gateway.handleTypingStart(mockSocket, conversationId);

      // Assert
      // client.to() excludes the sender automatically
      expect(toMock).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('should not emit typing if not participant', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockSocket.to = vi.fn();
      mockChatService.isParticipant.mockResolvedValue(false);

      // Act
      await gateway.handleTypingStart(mockSocket, conversationId);

      // Assert
      expect(mockSocket.to).not.toHaveBeenCalled();
    });
  });

  describe('handleTypingStop', () => {
    it('should clear typing state and emit to room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const emitMock = vi.fn();
      const toMock = vi.fn().mockReturnValue({ emit: emitMock });
      mockSocket.to = toMock;

      // Act
      await gateway.handleTypingStop(mockSocket, conversationId);

      // Assert
      expect(mockGatewayService.setTyping).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        false,
      );
      expect(emitMock).toHaveBeenCalledWith('typing:update', {
        conversationId,
        userId: mockUser.id,
        isTyping: false,
      });
    });

    it('should emit typing stop to room excluding sender', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const toMock = vi.fn().mockReturnValue({ emit: vi.fn() });
      mockSocket.to = toMock;

      // Act
      await gateway.handleTypingStop(mockSocket, conversationId);

      // Assert
      expect(toMock).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });
  });

  // Helper functions

  function createAuthenticatedSocket(user: SocketUser): AuthenticatedSocket {
    return {
      id: `socket-${Math.random().toString(36).substr(2, 9)}`,
      user,
      handshake: {
        auth: {},
        query: {},
        headers: {},
      },
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    } as unknown as AuthenticatedSocket;
  }
});
