import { Server } from 'socket.io';
import { AuthenticatedSocket, emitToUser } from '../index';
import { chatService } from '../../services/chat.service';
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

  // Send message
  socket.on('chat:sendMessage', async (data: { conversationId: string; content: string }, callback) => {
    try {
      const { conversationId, content } = data;

      if (!content || content.trim().length === 0) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Message cannot be empty' });
        }
        return;
      }

      // Send message via service
      const message = await chatService.sendMessage(userId, conversationId, { content });

      // Get sender info for the message
      const messageWithSender = {
        ...message,
        sender: {
          id: userId,
        },
      };

      // Emit to all in conversation room (including sender)
      io.to(`conversation:${conversationId}`).emit('chat:newMessage', {
        conversationId,
        message: messageWithSender,
      });

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
