import { describe, it, expect, beforeEach, vi, Mock, afterEach } from 'vitest';
import { Server, Socket } from 'socket.io';
import { AppGateway } from '../gateway.gateway.js';
import { GatewayService } from '../gateway.service.js';
import {
  AuthenticatedSocket,
  SocketUser,
} from '../interfaces/authenticated-socket.interface.js';

describe('AppGateway', () => {
  let gateway: AppGateway;
  let mockGatewayService: Record<string, Mock>;
  let mockJwtService: Record<string, Mock>;
  let mockConfigService: Record<string, Mock>;
  let mockRedisService: Record<string, Mock>;
  let mockServer: Partial<Server>;

  const mockUser: SocketUser = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    username: 'testuser',
  };

  const validToken = 'valid-jwt-token';
  const invalidToken = 'invalid-jwt-token';

  beforeEach(() => {
    vi.clearAllMocks();

    mockGatewayService = {
      setServer: vi.fn(),
      registerSocket: vi.fn().mockResolvedValue(undefined),
      unregisterSocket: vi.fn().mockResolvedValue(null),
      isUserOnline: vi.fn().mockResolvedValue(false),
      setUserOnline: vi.fn().mockResolvedValue(undefined),
      setUserOffline: vi.fn().mockResolvedValue(undefined),
      getConnectionCount: vi.fn().mockResolvedValue(1),
      setAppearOffline: vi.fn().mockResolvedValue(undefined),
      setTyping: vi.fn().mockResolvedValue(undefined),
      getOnlineStatusBatch: vi.fn().mockResolvedValue(new Map()),
    };

    mockJwtService = {
      verifyAsync: vi.fn(),
      sign: vi.fn().mockReturnValue('mock-token'),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('test-jwt-secret'),
    };

    mockRedisService = {
      getClient: vi.fn().mockReturnValue({
        duplicate: vi.fn().mockReturnValue({
          connect: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    mockServer = {
      adapter: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      sockets: {
        sockets: new Map(),
      } as any,
    };

    gateway = new AppGateway(
      mockGatewayService as any,
      mockJwtService as any,
      mockConfigService as any,
      mockRedisService as any,
    );

    // Set server on gateway
    (gateway as any).server = mockServer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleConnection', () => {
    it('should authenticate and connect client with valid JWT', async () => {
      // Arrange
      const mockSocket = createMockSocket(validToken);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        type: 'access',
      });

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(validToken, {
        secret: 'test-jwt-secret',
      });
      expect(mockGatewayService.registerSocket).toHaveBeenCalledWith(
        mockSocket.id,
        mockUser.id,
      );
      expect(mockSocket.join).toHaveBeenCalledWith(`user:${mockUser.id}`);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:success',
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
      );
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection with invalid JWT', async () => {
      // Arrange
      const mockSocket = createMockSocket(invalidToken);
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:error',
        'Invalid authentication token',
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
      expect(mockGatewayService.registerSocket).not.toHaveBeenCalled();
    });

    it('should reject connection with missing token', async () => {
      // Arrange
      const mockSocket = createMockSocket(null);

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:error',
        'Invalid authentication token',
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject connection with non-access token type', async () => {
      // Arrange
      const mockSocket = createMockSocket(validToken);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        type: 'refresh', // Wrong type
      });

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'auth:error',
        'Invalid authentication token',
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should mark user as online on first device connection', async () => {
      // Arrange
      const mockSocket = createMockSocket(validToken);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        type: 'access',
      });
      mockGatewayService.isUserOnline.mockResolvedValue(false); // User was offline

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockGatewayService.setUserOnline).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should NOT mark user as online if already online (multi-device)', async () => {
      // Arrange
      const mockSocket = createMockSocket(validToken);
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        type: 'access',
      });
      mockGatewayService.isUserOnline.mockResolvedValue(true); // User already online

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockGatewayService.setUserOnline).not.toHaveBeenCalled();
    });

    it('should extract token from handshake auth', async () => {
      // Arrange
      const mockSocket = createMockSocket(null);
      mockSocket.handshake.auth = { token: 'Bearer ' + validToken };
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        type: 'access',
      });

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(validToken, {
        secret: 'test-jwt-secret',
      });
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should extract token from authorization header', async () => {
      // Arrange
      const mockSocket = createMockSocket(null);
      mockSocket.handshake.headers = { authorization: 'Bearer ' + validToken };
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        type: 'access',
      });

      // Act
      await gateway.handleConnection(mockSocket);

      // Assert
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(validToken, {
        secret: 'test-jwt-secret',
      });
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should mark user as offline when last device disconnects', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockGatewayService.unregisterSocket.mockResolvedValue(mockUser.id); // Returns userId = went offline

      // Act
      await gateway.handleDisconnect(mockSocket);

      // Assert
      expect(mockGatewayService.unregisterSocket).toHaveBeenCalledWith(
        mockSocket.id,
      );
      expect(mockGatewayService.setUserOffline).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should NOT mark user as offline when other devices still connected', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      mockGatewayService.unregisterSocket.mockResolvedValue(null); // Returns null = still has connections

      // Act
      await gateway.handleDisconnect(mockSocket);

      // Assert
      expect(mockGatewayService.unregisterSocket).toHaveBeenCalledWith(
        mockSocket.id,
      );
      expect(mockGatewayService.setUserOffline).not.toHaveBeenCalled();
    });

    it('should handle disconnect for unauthenticated socket gracefully', async () => {
      // Arrange
      const mockSocket = createMockSocket(null) as AuthenticatedSocket;
      // No user attached

      // Act
      await gateway.handleDisconnect(mockSocket);

      // Assert
      expect(mockGatewayService.setUserOffline).not.toHaveBeenCalled();
    });
  });

  describe('handlePresenceOnline', () => {
    it('should disable appear offline mode', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);

      // Act
      const result = await gateway.handlePresenceOnline(mockSocket);

      // Assert
      expect(mockGatewayService.setAppearOffline).toHaveBeenCalledWith(
        mockUser.id,
        false,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('handlePresenceOffline', () => {
    it('should enable appear offline mode', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);

      // Act
      const result = await gateway.handlePresenceOffline(mockSocket);

      // Assert
      expect(mockGatewayService.setAppearOffline).toHaveBeenCalledWith(
        mockUser.id,
        true,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('handleTypingStart', () => {
    it('should set typing state and emit to room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const conversationId = 'conv-uuid-1234';
      const toMock = vi.fn().mockReturnValue({
        emit: vi.fn(),
      });
      mockSocket.to = toMock;

      // Act
      await gateway.handleTypingStart(mockSocket, conversationId);

      // Assert
      expect(mockGatewayService.setTyping).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        true,
      );
      expect(toMock).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });
  });

  describe('handleTypingStop', () => {
    it('should clear typing state and emit to room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const conversationId = 'conv-uuid-1234';
      const toMock = vi.fn().mockReturnValue({
        emit: vi.fn(),
      });
      mockSocket.to = toMock;

      // Act
      await gateway.handleTypingStop(mockSocket, conversationId);

      // Assert
      expect(mockGatewayService.setTyping).toHaveBeenCalledWith(
        conversationId,
        mockUser.id,
        false,
      );
      expect(toMock).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });
  });

  describe('handleJoinConversation', () => {
    it('should join conversation room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const conversationId = 'conv-uuid-1234';

      // Act
      const result = await gateway.handleJoinConversation(
        mockSocket,
        conversationId,
      );

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('handleLeaveConversation', () => {
    it('should leave conversation room', async () => {
      // Arrange
      const mockSocket = createAuthenticatedSocket(mockUser);
      const conversationId = 'conv-uuid-1234';

      // Act
      const result = await gateway.handleLeaveConversation(
        mockSocket,
        conversationId,
      );

      // Assert
      expect(mockSocket.leave).toHaveBeenCalledWith(
        `conversation:${conversationId}`,
      );
      expect(result).toEqual({ success: true });
    });
  });

  // Helper functions

  function createMockSocket(token: string | null): Socket {
    return {
      id: `socket-${Math.random().toString(36).substr(2, 9)}`,
      handshake: {
        auth: token ? { token } : {},
        query: token ? { token } : {},
        headers: {},
      },
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      emit: vi.fn(),
      disconnect: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    } as unknown as Socket;
  }

  function createAuthenticatedSocket(user: SocketUser): AuthenticatedSocket {
    const socket = createMockSocket(null) as AuthenticatedSocket;
    socket.user = user;
    return socket;
  }
});
