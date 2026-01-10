import { Server } from 'socket.io';
import { AuthenticatedSocket, emitToUser } from '../index';
import { chatService } from '../../services/chat.service';
import { notificationsService } from '../../services/notifications.service';
import { prisma } from '../../config/database';
import { isDev } from '../../config';

// Track typing status
const typingUsers = new Map<string, Set<string>>(); // conversationId -> Set of userIds

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket): void {
  const userId = socket.user.userId;

  // Join conversation room
  socket.on('chat:join', async (conversationId: string, callback) => {
    try {
      // Verify user is participant in this conversation
      const messages = await chatService.getMessages(userId, conversationId, 1, 1);

      // If no error, user is participant
      socket.join(`conversation:${conversationId}`);

      if (isDev) {
        console.log(`[Socket] User ${userId} joined conversation ${conversationId}`);
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Cannot join conversation' });
      }
    }
  });

  // Leave conversation room
  socket.on('chat:leave', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);

    // Clear typing status
    const conversationTyping = typingUsers.get(conversationId);
    if (conversationTyping) {
      conversationTyping.delete(userId);
    }

    if (isDev) {
      console.log(`[Socket] User ${userId} left conversation ${conversationId}`);
    }
  });

  // Send message (with optional images)
  socket.on('chat:sendMessage', async (data: { conversationId: string; content: string; replyToId?: string; imageUrls?: string[] }, callback) => {
    try {
      const { conversationId, content, replyToId, imageUrls } = data;
      const hasImages = imageUrls && imageUrls.length > 0;

      if ((!content || content.trim().length === 0) && !hasImages) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Message or image is required' });
        }
        return;
      }

      // Send message via service
      const message = await chatService.sendMessage(userId, conversationId, { content: content || '', replyToId }, imageUrls);

      // Get sender info for the message
      const messageWithSender = {
        ...message,
        sender: {
          id: userId,
        },
      };

      const messagePayload = {
        conversationId,
        message: messageWithSender,
      };

      // Emit to all in conversation room (including sender)
      io.to(`conversation:${conversationId}`).emit('chat:newMessage', messagePayload);

      // Also emit to the other participant's user room (for when they're not in the conversation)
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      for (const participant of participants) {
        if (participant.userId !== userId) {
          // Send to the other user's personal room
          emitToUser(participant.userId, 'chat:newMessage', messagePayload);

          // Create notification for the recipient
          try {
            const sender = await prisma.user.findUnique({
              where: { id: userId },
              select: { username: true, fullName: true },
            });

            const senderName = sender?.fullName || sender?.username || 'მომხმარებელი';
            const messagePreview = content
              ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
              : hasImages ? '📷 ფოტო' : '';
            const notification = await notificationsService.createNotification({
              userId: participant.userId,
              type: 'NEW_MESSAGE',
              title: 'ახალი შეტყობინება',
              body: `${senderName}: ${messagePreview}`,
              data: { conversationId, senderId: userId },
            });

            // Emit real-time notification
            emitToUser(participant.userId, 'new_notification', { notification });
          } catch (error) {
            // Silently fail - message was sent, notification is secondary
            if (isDev) {
              console.error('[Socket] Failed to create message notification:', error);
            }
          }
        }
      }

      // Clear typing status
      const conversationTyping = typingUsers.get(conversationId);
      if (conversationTyping) {
        conversationTyping.delete(userId);
        socket.to(`conversation:${conversationId}`).emit('chat:typingStop', {
          conversationId,
          userId,
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, message });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMessage });
      }
    }
  });

  // Typing indicator - start
  socket.on('chat:typing', (conversationId: string) => {
    if (!typingUsers.has(conversationId)) {
      typingUsers.set(conversationId, new Set());
    }
    typingUsers.get(conversationId)!.add(userId);

    // Notify others in conversation
    socket.to(`conversation:${conversationId}`).emit('chat:typingStart', {
      conversationId,
      userId,
    });
  });

  // Typing indicator - stop
  socket.on('chat:stopTyping', (conversationId: string) => {
    const conversationTyping = typingUsers.get(conversationId);
    if (conversationTyping) {
      conversationTyping.delete(userId);
    }

    // Notify others in conversation
    socket.to(`conversation:${conversationId}`).emit('chat:typingStop', {
      conversationId,
      userId,
    });
  });

  // Mark messages as read
  socket.on('chat:markRead', async (conversationId: string, callback) => {
    try {
      await chatService.markAsRead(userId, conversationId);

      // Notify the other user that messages were read
      socket.to(`conversation:${conversationId}`).emit('chat:messagesRead', {
        conversationId,
        readBy: userId,
      });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to mark as read' });
      }
    }
  });

  // Add reaction to message
  socket.on('chat:addReaction', async (data: { conversationId: string; messageId: string; emoji: string }, callback) => {
    try {
      const { conversationId, messageId, emoji } = data;

      await chatService.addReaction(userId, conversationId, messageId, emoji);

      const reactionPayload = {
        conversationId,
        messageId,
        emoji,
        userId,
      };

      // Emit to all in conversation room
      io.to(`conversation:${conversationId}`).emit('chat:reactionAdded', reactionPayload);

      // Also emit to participants not in the room
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      for (const participant of participants) {
        if (participant.userId !== userId) {
          emitToUser(participant.userId, 'chat:reactionAdded', reactionPayload);
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add reaction';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMessage });
      }
    }
  });

  // Remove reaction from message
  socket.on('chat:removeReaction', async (data: { conversationId: string; messageId: string; emoji: string }, callback) => {
    try {
      const { conversationId, messageId, emoji } = data;

      await chatService.removeReaction(userId, conversationId, messageId, emoji);

      const reactionPayload = {
        conversationId,
        messageId,
        emoji,
        userId,
      };

      // Emit to all in conversation room
      io.to(`conversation:${conversationId}`).emit('chat:reactionRemoved', reactionPayload);

      // Also emit to participants not in the room
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      for (const participant of participants) {
        if (participant.userId !== userId) {
          emitToUser(participant.userId, 'chat:reactionRemoved', reactionPayload);
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove reaction';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMessage });
      }
    }
  });

  // Edit message (with optional image changes)
  socket.on('chat:editMessage', async (data: { conversationId: string; messageId: string; content: string; removedImageIds?: string[]; newImageUrls?: string[] }, callback) => {
    try {
      const { conversationId, messageId, content, removedImageIds, newImageUrls } = data;

      const hasNewImages = newImageUrls && newImageUrls.length > 0;
      const hasContent = content && content.trim().length > 0;

      // Need either content or images (existing or new)
      if (!hasContent && !hasNewImages) {
        // Check if message will have images after removal
        // Let the service handle this validation
      }

      const message = await chatService.updateMessage(userId, conversationId, messageId, content, removedImageIds, newImageUrls);

      const editPayload = {
        conversationId,
        message,
      };

      // Emit to all in conversation room
      io.to(`conversation:${conversationId}`).emit('chat:messageEdited', editPayload);

      // Also emit to participants not in the room
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      for (const participant of participants) {
        if (participant.userId !== userId) {
          emitToUser(participant.userId, 'chat:messageEdited', editPayload);
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true, message });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMessage });
      }
    }
  });

  // Delete message
  socket.on('chat:deleteMessage', async (data: { conversationId: string; messageId: string }, callback) => {
    try {
      const { conversationId, messageId } = data;

      await chatService.deleteMessage(userId, conversationId, messageId);

      const deletePayload = {
        conversationId,
        messageId,
      };

      // Emit to all in conversation room
      io.to(`conversation:${conversationId}`).emit('chat:messageDeleted', deletePayload);

      // Also emit to participants not in the room
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      for (const participant of participants) {
        if (participant.userId !== userId) {
          emitToUser(participant.userId, 'chat:messageDeleted', deletePayload);
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
      if (typeof callback === 'function') {
        callback({ success: false, error: errorMessage });
      }
    }
  });

  // Handle disconnect - clear typing status
  socket.on('disconnect', () => {
    // Clear typing status from all conversations
    for (const [conversationId, users] of typingUsers.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        socket.to(`conversation:${conversationId}`).emit('chat:typingStop', {
          conversationId,
          userId,
        });
      }
    }
  });
}
