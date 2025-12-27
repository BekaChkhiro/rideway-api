import {
  Controller,
  Get,
  Post,
  Patch,
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
import { NotificationsService } from './notifications.service.js';
import { DeviceTokensService } from './fcm/index.js';
import {
  NotificationQueryDto,
  UpdateNotificationPreferencesDto,
  RegisterDeviceDto,
} from './dto/index.js';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deviceTokensService: DeviceTokensService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  async getNotifications(
    @CurrentUser() user: User,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount: count };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences' })
  async getPreferences(@CurrentUser() user: User) {
    const preferences = await this.notificationsService.getPreferences(user.id);
    return {
      pushEnabled: preferences.pushEnabled,
      emailEnabled: preferences.emailEnabled,
      newFollower: preferences.newFollower,
      postLike: preferences.postLike,
      postComment: preferences.postComment,
      commentReply: preferences.commentReply,
      newMessage: preferences.newMessage,
      threadReply: preferences.threadReply,
      listingInquiry: preferences.listingInquiry,
    };
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const preferences = await this.notificationsService.updatePreferences(
      user.id,
      dto,
    );
    return {
      pushEnabled: preferences.pushEnabled,
      emailEnabled: preferences.emailEnabled,
      newFollower: preferences.newFollower,
      postLike: preferences.postLike,
      postComment: preferences.postComment,
      commentReply: preferences.commentReply,
      newMessage: preferences.newMessage,
      threadReply: preferences.threadReply,
      listingInquiry: preferences.listingInquiry,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotification(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.findOne(id, user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 204, description: 'Marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notificationsService.markAsRead(id, user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  async markAllAsRead(@CurrentUser() user: User) {
    const count = await this.notificationsService.markAllAsRead(user.id);
    return { markedCount: count };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 204, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notificationsService.delete(id, user.id);
  }

  // ==========================================
  // Device Token Endpoints
  // ==========================================

  @Get('devices')
  @ApiOperation({ summary: 'List registered devices' })
  @ApiResponse({ status: 200, description: 'List of devices' })
  async getDevices(@CurrentUser() user: User) {
    const devices = await this.deviceTokensService.getUserDevices(user.id);
    return { devices };
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register device for push notifications' })
  @ApiResponse({ status: 201, description: 'Device registered' })
  async registerDevice(
    @CurrentUser() user: User,
    @Body() dto: RegisterDeviceDto,
  ) {
    const device = await this.deviceTokensService.register(user.id, dto);
    return {
      id: device.id,
      deviceType: device.deviceType,
      deviceName: device.deviceName,
      isActive: device.isActive,
    };
  }

  @Delete('devices/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister device' })
  @ApiResponse({ status: 204, description: 'Device unregistered' })
  async unregisterDevice(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    await this.deviceTokensService.unregister(user.id, token);
  }

  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister all devices' })
  @ApiResponse({ status: 204, description: 'All devices unregistered' })
  async unregisterAllDevices(@CurrentUser() user: User) {
    await this.deviceTokensService.unregisterAll(user.id);
  }
}
