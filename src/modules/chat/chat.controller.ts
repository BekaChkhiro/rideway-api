import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@modules/auth/index.js';
import { User } from '@database/index.js';
import { ChatService } from './chat.service.js';
import {
  CreateConversationDto,
  SendMessageDto,
  MessageQueryDto,
  MuteConversationDto,
} from './dto/index.js';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getConversations(@CurrentUser() user: User) {
    return this.chatService.getConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create or get existing conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created or found' })
  @ApiResponse({
    status: 403,
    description: 'Cannot create conversation with blocked user',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async createConversation(
    @CurrentUser() user: User,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.findOrCreateConversation(
      user.id,
      dto.participantId,
    );
    return this.chatService.getConversation(conversation.id, user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.getConversation(id, user.id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  async getMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.chatService.getMessages(id, user.id, query);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 403, description: 'Not a participant or blocked' })
  async sendMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(id, user.id, dto);
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: message.sender
        ? {
            id: message.sender.id,
            username: message.sender.profile?.username,
            avatarUrl: message.sender.profile?.avatarUrl,
          }
        : undefined,
      content: message.content,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      isEdited: message.isEdited,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ApiResponse({ status: 204, description: 'Marked as read' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  async markAsRead(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('messageId') messageId?: string,
  ) {
    await this.chatService.markAsRead(id, user.id, messageId);
  }

  @Post('conversations/:id/mute')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mute or unmute conversation' })
  @ApiResponse({ status: 204, description: 'Mute status updated' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  async muteConversation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MuteConversationDto,
  ) {
    await this.chatService.muteConversation(id, user.id, dto.muted);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiResponse({ status: 204, description: 'Message deleted' })
  @ApiResponse({
    status: 404,
    description: 'Message not found or not the sender',
  })
  async deleteMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.chatService.deleteMessage(id, user.id);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get unread message counts' })
  @ApiResponse({ status: 200, description: 'Unread counts' })
  async getUnreadCount(@CurrentUser() user: User) {
    return this.chatService.getUnreadCount(user.id);
  }
}
