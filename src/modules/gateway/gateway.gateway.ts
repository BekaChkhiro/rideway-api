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
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
// import { createAdapter } from '@socket.io/redis-adapter';  // Disabled for now
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
    @Inject(GatewayService) private readonly gatewayService: GatewayService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  async afterInit(
    server: Server<ClientToServerEvents, ServerToClientEvents>,
  ): Promise<void> {
    this.logger.log('WebSocket Gateway initialized');

    // Redis adapter setup is disabled for now (single-server mode)
    // TODO: Enable for horizontal scaling in production
    // The ioredis duplicate() requires special handling that was causing startup delays
    this.logger.log('Running Socket.io in single-server mode (Redis adapter disabled)');

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

      // Check if this is first connection (user was offline)
      const wasOffline = !(await this.gatewayService.isUserOnline(user.id));

      // Register socket in Redis (supports multiple devices)
      await this.gatewayService.registerSocket(client.id, user.id);

      // Join user's personal room for direct messages
      await client.join(`user:${user.id}`);

      // Emit success
      client.emit('auth:success', user);

      // Only broadcast online if user was offline (first device connecting)
      if (wasOffline) {
        await this.gatewayService.setUserOnline(user.id);
      }

      const connectionCount = await this.gatewayService.getConnectionCount(user.id);
      this.logger.log(
        `Client connected: ${client.id} (User: ${user.id}, ${user.email}, connections: ${connectionCount})`,
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
        // Unregister socket and check if user went offline (last device disconnecting)
        const wentOffline = await this.gatewayService.unregisterSocket(client.id);

        if (wentOffline) {
          // Broadcast offline status to followers
          await this.gatewayService.setUserOffline(userId);
          this.logger.log(`User ${userId} went offline (all devices disconnected)`);
        } else {
          const remaining = await this.gatewayService.getConnectionCount(userId);
          this.logger.debug(`User ${userId} still has ${remaining} active connection(s)`);
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
  ): Promise<{ success: boolean }> {
    const userId = client.user.id;
    // Disable "appear offline" mode
    await this.gatewayService.setAppearOffline(userId, false);
    return { success: true };
  }

  @SubscribeMessage('presence:offline')
  @UseGuards(WsAuthGuard)
  async handlePresenceOffline(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<{ success: boolean }> {
    // Don't actually disconnect, just enable "appear offline" mode
    // This is for when user wants to appear offline while still connected
    const userId = client.user.id;
    await this.gatewayService.setAppearOffline(userId, true);
    return { success: true };
  }

  @SubscribeMessage('presence:status')
  @UseGuards(WsAuthGuard)
  async handleGetPresenceStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() userIds: string[],
  ): Promise<{ statuses: Record<string, { isOnline: boolean; lastSeen?: Date }> }> {
    const statusMap = await this.gatewayService.getOnlineStatusBatch(userIds);
    const statuses: Record<string, { isOnline: boolean; lastSeen?: Date }> = {};

    for (const [odUserId, info] of statusMap) {
      statuses[odUserId] = {
        isOnline: info.isOnline,
        lastSeen: info.lastSeen,
      };
    }

    return { statuses };
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
