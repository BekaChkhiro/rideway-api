import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '@redis/redis.service.js';
import { GatewayService } from './gateway.service.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import { WsCurrentUser } from './decorators/ws-current-user.decorator.js';
import {
  AuthenticatedSocket,
  SocketUser,
} from './interfaces/authenticated-socket.interface.js';
import {
  ServerToClientEvents,
  ClientToServerEvents,
} from './interfaces/socket-events.interface.js';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure based on environment
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly gatewayService: GatewayService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async afterInit(
    server: Server<ClientToServerEvents, ServerToClientEvents>,
  ): Promise<void> {
    this.logger.log('WebSocket Gateway initialized');

    // Set up Redis adapter for horizontal scaling
    try {
      const pubClient = this.redisService.getClient().duplicate();
      const subClient = this.redisService.getClient().duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Redis adapter configured for Socket.io');
    } catch (error) {
      this.logger.warn(
        'Failed to set up Redis adapter, running in single-server mode',
        error,
      );
    }

    // Pass server to gateway service
    this.gatewayService.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract and validate JWT token
      const user = await this.authenticateClient(client);

      if (!user) {
        this.logger.warn(`Client ${client.id} connection rejected: Invalid token`);
        client.emit('auth:error', 'Invalid authentication token');
        client.disconnect(true);
        return;
      }

      // Attach user to socket
      (client as AuthenticatedSocket).user = user;

      // Register socket in Redis
      await this.gatewayService.registerSocket(client.id, user.id);

      // Join user's personal room for direct messages
      await client.join(`user:${user.id}`);

      // Emit success
      client.emit('auth:success', user);

      // Broadcast online status to relevant users (could be followers, contacts, etc.)
      this.server.emit('user:online', user.id);

      this.logger.log(
        `Client connected: ${client.id} (User: ${user.id}, ${user.email})`,
      );
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}:`, error);
      client.emit('error', { message: 'Connection failed', code: 'CONNECTION_ERROR' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      const authenticatedClient = client as AuthenticatedSocket;
      const userId = authenticatedClient.user?.id;

      if (userId) {
        // Unregister socket and check if user went offline
        const wentOffline = await this.gatewayService.unregisterSocket(client.id);

        if (wentOffline) {
          // Broadcast offline status
          this.server.emit('user:offline', userId);
          this.logger.log(`User ${userId} went offline`);
        }
      }

      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnect error for ${client.id}:`, error);
    }
  }

  // Presence Events

  @SubscribeMessage('presence:online')
  @UseGuards(WsAuthGuard)
  async handlePresenceOnline(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const userId = client.user.id;
    await this.gatewayService.registerSocket(client.id, userId);
    this.server.emit('user:online', userId);
  }

  @SubscribeMessage('presence:offline')
  @UseGuards(WsAuthGuard)
  async handlePresenceOffline(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    // Don't actually disconnect, just broadcast offline status
    // This is for when user wants to appear offline
    const userId = client.user.id;
    this.server.emit('user:offline', userId);
  }

  // Room Management Events

  @SubscribeMessage('join:conversation')
  @UseGuards(WsAuthGuard)
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ): Promise<{ success: boolean }> {
    // TODO: Verify user is participant in conversation
    await client.join(`conversation:${conversationId}`);
    this.logger.debug(
      `User ${client.user.id} joined conversation ${conversationId}`,
    );
    return { success: true };
  }

  @SubscribeMessage('leave:conversation')
  @UseGuards(WsAuthGuard)
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ): Promise<{ success: boolean }> {
    await client.leave(`conversation:${conversationId}`);
    this.logger.debug(
      `User ${client.user.id} left conversation ${conversationId}`,
    );
    return { success: true };
  }

  // Typing Indicators

  @SubscribeMessage('typing:start')
  @UseGuards(WsAuthGuard)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    const userId = client.user.id;

    await this.gatewayService.setTyping(conversationId, userId, true);

    // Emit to conversation room (excluding sender)
    client.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  @UseGuards(WsAuthGuard)
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    const userId = client.user.id;

    await this.gatewayService.setTyping(conversationId, userId, false);

    // Emit to conversation room (excluding sender)
    client.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      isTyping: false,
    });
  }

  // Private helper methods

  private async authenticateClient(client: Socket): Promise<SocketUser | null> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        return null;
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!secret) {
        this.logger.error('JWT_ACCESS_SECRET not configured');
        return null;
      }

      const payload = await this.jwtService.verifyAsync(token, { secret });

      if (payload.type !== 'access') {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
      };
    } catch (error) {
      this.logger.debug(`Token validation failed: ${(error as Error).message}`);
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    // Try handshake auth
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return String(authToken).replace('Bearer ', '');
    }

    // Try query parameter
    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken.replace('Bearer ', '');
    }

    // Try authorization header
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      return authHeader.replace('Bearer ', '');
    }

    return null;
  }
}
