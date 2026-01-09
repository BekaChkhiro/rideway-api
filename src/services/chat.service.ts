import { prisma } from '../config/database';
import { AppError } from '../middleware/error-handler';
import { SendMessageInput } from '../validators/chat';

interface ConversationParticipant {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ConversationResponse {
  id: string;
  participant: ConversationParticipant;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;
}

interface MessageResponse {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  isOwn: boolean;
  createdAt: Date;
}

interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const chatService = {
  /**
   * Get user's conversations
   */
  async getConversations(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<ConversationResponse>> {
    const skip = (page - 1) * limit;

    // Get conversations where user is participant
    const [conversations, total] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: {
          conversation: { lastMessageAt: 'desc' },
        },
        include: {
          conversation: {
            include: {
              participants: {
                where: { userId: { not: userId } },
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      fullName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              messages: {
                where: {
                  senderId: { not: userId },
                  isRead: false,
                },
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.conversationParticipant.count({
        where: { userId },
      }),
    ]);

    const items: ConversationResponse[] = conversations.map((cp) => {
      const otherParticipant = cp.conversation.participants[0]?.user;
      return {
        id: cp.conversation.id,
        participant: otherParticipant
          ? {
              id: otherParticipant.id,
              username: otherParticipant.username,
              fullName: otherParticipant.fullName,
              avatarUrl: otherParticipant.avatarUrl,
            }
          : {
              id: '',
              username: 'deleted',
              fullName: 'Deleted User',
              avatarUrl: null,
            },
        lastMessage: cp.conversation.lastMessage,
        lastMessageAt: cp.conversation.lastMessageAt,
        unreadCount: cp.conversation.messages.length,
        createdAt: cp.conversation.createdAt,
      };
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get or create conversation with another user
   */
  async getOrCreateConversation(
    userId: string,
    participantId: string
  ): Promise<ConversationResponse> {
    // Can't chat with yourself
    if (userId === participantId) {
      throw new AppError(400, 'INVALID_PARTICIPANT', 'საკუთარ თავთან ვერ დაიწყებთ საუბარს');
    }

    // Check if participant exists
    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        isActive: true,
      },
    });

    if (!participant || !participant.isActive) {
      throw new AppError(404, 'USER_NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');
    }

    // Check if blocked
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: participantId },
          { blockerId: participantId, blockedId: userId },
        ],
      },
    });

    if (blocked) {
      throw new AppError(403, 'USER_BLOCKED', 'მომხმარებელთან მიმოწერა შეუძლებელია');
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: {
        messages: {
          where: {
            senderId: { not: userId },
            isRead: false,
          },
          select: { id: true },
        },
      },
    });

    if (existingConversation) {
      return {
        id: existingConversation.id,
        participant: {
          id: participant.id,
          username: participant.username,
          fullName: participant.fullName,
          avatarUrl: participant.avatarUrl,
        },
        lastMessage: existingConversation.lastMessage,
        lastMessageAt: existingConversation.lastMessageAt,
        unreadCount: existingConversation.messages.length,
        createdAt: existingConversation.createdAt,
      };
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
    });

    return {
      id: newConversation.id,
      participant: {
        id: participant.id,
        username: participant.username,
        fullName: participant.fullName,
        avatarUrl: participant.avatarUrl,
      },
      lastMessage: null,
      lastMessageAt: null,
      unreadCount: 0,
      createdAt: newConversation.createdAt,
    };
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(
    userId: string,
    conversationId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<MessageResponse>> {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'საუბარი ვერ მოიძებნა');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          senderId: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.message.count({
        where: { conversationId },
      }),
    ]);

    const items: MessageResponse[] = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      isRead: msg.isRead,
      isOwn: msg.senderId === userId,
      createdAt: msg.createdAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Send a message
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    data: SendMessageInput
  ): Promise<MessageResponse> {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: { userId: { not: userId } },
            },
          },
        },
      },
    });

    if (!participant) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'საუბარი ვერ მოიძებნა');
    }

    // Check if other user is blocked
    const otherUserId = participant.conversation.participants[0]?.userId;
    if (otherUserId) {
      const blocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: otherUserId },
            { blockerId: otherUserId, blockedId: userId },
          ],
        },
      });

      if (blocked) {
        throw new AppError(403, 'USER_BLOCKED', 'მომხმარებელთან მიმოწერა შეუძლებელია');
      }
    }

    // Create message and update conversation in transaction
    const message = await prisma.$transaction(async (tx) => {
      const newMessage = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: data.content,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: data.content.substring(0, 100),
          lastMessageAt: new Date(),
        },
      });

      return newMessage;
    });

    return {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      isRead: message.isRead,
      isOwn: true,
      createdAt: message.createdAt,
    };
  },

  /**
   * Mark conversation as read
   */
  async markAsRead(userId: string, conversationId: string): Promise<void> {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'საუბარი ვერ მოიძებნა');
    }

    // Mark all messages from other users as read
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    // Update last read timestamp
    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    });
  },

  /**
   * Get total unread messages count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const count = await prisma.message.count({
      where: {
        conversation: {
          participants: {
            some: { userId },
          },
        },
        senderId: { not: userId },
        isRead: false,
      },
    });

    return count;
  },

  /**
   * Delete a conversation (for one user only - marks as deleted but keeps messages)
   * Note: Currently not in API spec, but might be useful
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
      },
    });

    if (!participant) {
      throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'საუბარი ვერ მოიძებნა');
    }

    // Remove participant (user won't see this conversation anymore)
    await prisma.conversationParticipant.delete({
      where: { id: participant.id },
    });

    // Check if conversation has no participants left
    const remainingParticipants = await prisma.conversationParticipant.count({
      where: { conversationId },
    });

    // If no participants left, delete entire conversation
    if (remainingParticipants === 0) {
      await prisma.conversation.delete({
        where: { id: conversationId },
      });
    }
  },
};
