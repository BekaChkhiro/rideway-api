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
import { GatewayService } from '@modules/gateway/gateway.service.js';
import {
  AuthenticatedSocket,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@modules/gateway/interfaces/index.js';
import { ChatService } from './chat.service.js';
import { SendMessageSocketDto } from './dto/index.js';
import { MessageType } from './entities/index.js';

interface MessageReadPayload {
  conversationId: string;
  messageId: string;
}

@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(GatewayService) private readonly gatewayService: GatewayService,
  ) {}

  @SubscribeMessage('join:conversation')
  @UseGuards(WsAuthGuard)
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const userId = client.user.id;

    // Verify user is participant
    const isParticipant = await this.chatService.isParticipant(
      conversationId,
      userId,
    );

    if (!isParticipant) {
      return {
        success: false,
        error: 'Not a participant of this conversation',
      };
    }

    await client.join(`conversation:${conversationId}`);
    this.logger.debug(`User ${userId} joined conversation ${conversationId}`);

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

  @SubscribeMessage('message:send')
  @UseGuards(WsAuthGuard)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageSocketDto,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const userId = client.user.id;
    const { conversationId, content, messageType, mediaUrl } = data;

    try {
      // Send message via service
      const message = await this.chatService.sendMessage(
        conversationId,
        userId,
        {
          content,
          messageType: messageType || MessageType.TEXT,
          mediaUrl,
        },
      );

      // Emit to all participants in the conversation room
      this.server.to(`conversation:${conversationId}`).emit('message:new', {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId || userId,
        content: message.content || '',
        messageType: message.messageType,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
        isEdited: message.isEdited,
      });

      // Notify offline users
      const otherParticipantId = await this.chatService.getOtherParticipantId(
        conversationId,
        userId,
      );

      if (otherParticipantId) {
        const isOnline =
          await this.gatewayService.isUserOnline(otherParticipantId);

        if (!isOnline) {
          // TODO: Queue push notification via BullMQ
          this.logger.debug(
            `User ${otherParticipantId} is offline, should queue push notification`,
          );
        } else {
          // Emit notification to user's personal room if not in conversation
          const roomMembers = this.gatewayService.getRoomMembers(
            `conversation:${conversationId}`,
          );
          const otherSocket =
            await this.gatewayService.getUserSocket(otherParticipantId);

          if (otherSocket && !roomMembers.includes(otherSocket)) {
            // User is online but not viewing this conversation
            this.gatewayService.emitToUser(
              otherParticipantId,
              'notification:new',
              {
                id: `msg-${message.id}`,
                type: 'new_message',
                title: `New message from ${client.user.username}`,
                body: message.content?.substring(0, 100) || 'Sent a message',
                data: {
                  conversationId,
                  messageId: message.id,
                },
                createdAt: new Date(),
              },
            );
          }
        }
      }

      this.logger.debug(
        `Message ${message.id} sent in conversation ${conversationId}`,
      );

      return { success: true, messageId: message.id };
    } catch (error) {
      this.logger.error(`Failed to send message: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }

  @SubscribeMessage('message:read')
  @UseGuards(WsAuthGuard)
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageReadPayload,
  ): Promise<{ success: boolean; error?: string }> {
    const userId = client.user.id;
    const { conversationId, messageId } = data;

    try {
      await this.chatService.markAsRead(conversationId, userId, messageId);

      // Emit read receipt to conversation room
      client.to(`conversation:${conversationId}`).emit('message:read', {
        userId,
        messageId,
      });

      this.logger.debug(
        `User ${userId} read message ${messageId} in conversation ${conversationId}`,
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  @SubscribeMessage('typing:start')
  @UseGuards(WsAuthGuard)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ): Promise<void> {
    const userId = client.user.id;

    // Verify participant
    const isParticipant = await this.chatService.isParticipant(
      conversationId,
      userId,
    );

    if (!isParticipant) {
      return;
    }

    await this.gatewayService.setTyping(conversationId, userId, true);

    // Emit to room excluding sender
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

    // Emit to room excluding sender
    client.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      isTyping: false,
    });
  }
}
