import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsAuthGuard } from '@modules/gateway/guards/ws-auth.guard.js';
import {
  AuthenticatedSocket,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@modules/gateway/interfaces/index.js';
import { NotificationsService } from './notifications.service.js';

@WebSocketGateway()
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @SubscribeMessage('notifications:get-unread-count')
  @UseGuards(WsAuthGuard)
  async handleGetUnreadCount(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<{ unreadCount: number }> {
    const count = await this.notificationsService.getUnreadCount(
      client.user.id,
    );
    return { unreadCount: count };
  }

  @SubscribeMessage('notifications:mark-read')
  @UseGuards(WsAuthGuard)
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() notificationId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.notificationsService.markAsRead(
        notificationId,
        client.user.id,
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  @SubscribeMessage('notifications:mark-all-read')
  @UseGuards(WsAuthGuard)
  async handleMarkAllAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<{ success: boolean; markedCount: number }> {
    const count = await this.notificationsService.markAllAsRead(client.user.id);
    return { success: true, markedCount: count };
  }
}
