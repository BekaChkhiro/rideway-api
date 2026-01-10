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
  lastMessageSenderId: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;
}

interface ReplyInfo {
  id: string;
  content: string;
  senderId: string;
}

interface ReactionInfo {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface MessageImageInfo {
  id: string;
  url: string;
  order: number;
}

interface MediaItem {
  id: string;
  url: string;
  messageId: string;
  senderId: string;
  createdAt: Date;
}

interface MessageResponse {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  isDeleted: boolean;
  editedAt: Date | null;
  isOwn: boolean;
  replyTo: ReplyInfo | null;
  reactions: ReactionInfo[];
  images: MessageImageInfo[];
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
        lastMessageSenderId: cp.conversation.lastMessageSenderId,
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
        lastMessageSenderId: existingConversation.lastMessageSenderId,
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
      lastMessageSenderId: null,
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
          isDeleted: true,
          editedAt: true,
          createdAt: true,
          replyTo: {
            select: {
              id: true,
              content: true,
              senderId: true,
            },
          },
          reactions: {
            select: {
              emoji: true,
              userId: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      }),
      prisma.message.count({
        where: { conversationId },
      }),
    ]);

    const items: MessageResponse[] = messages.map((msg) => {
      // Group reactions by emoji
      const reactionMap = new Map<string, { count: number; hasReacted: boolean }>();
      msg.reactions.forEach((r) => {
        const existing = reactionMap.get(r.emoji);
        if (existing) {
          existing.count++;
          if (r.userId === userId) existing.hasReacted = true;
        } else {
          reactionMap.set(r.emoji, {
            count: 1,
            hasReacted: r.userId === userId,
          });
        }
      });

      const reactions: ReactionInfo[] = Array.from(reactionMap.entries()).map(
        ([emoji, data]) => ({
          emoji,
          count: data.count,
          hasReacted: data.hasReacted,
        })
      );

      return {
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        isRead: msg.isRead,
        isDeleted: msg.isDeleted,
        editedAt: msg.editedAt,
        isOwn: msg.senderId === userId,
        replyTo: msg.replyTo
          ? {
              id: msg.replyTo.id,
              content: msg.replyTo.content,
              senderId: msg.replyTo.senderId,
            }
          : null,
        reactions,
        images: msg.images,
        createdAt: msg.createdAt,
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
   * Get all media from a conversation
   */
  async getMedia(
    userId: string,
    conversationId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<MediaItem>> {
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

    const [images, total] = await Promise.all([
      prisma.messageImage.findMany({
        where: {
          message: {
            conversationId,
            isDeleted: false,
          },
        },
        skip,
        take: limit,
        orderBy: { message: { createdAt: 'desc' } },
        select: {
          id: true,
          url: true,
          message: {
            select: {
              id: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.messageImage.count({
        where: {
          message: {
            conversationId,
            isDeleted: false,
          },
        },
      }),
    ]);

    const items: MediaItem[] = images.map((img) => ({
      id: img.id,
      url: img.url,
      messageId: img.message.id,
      senderId: img.message.senderId,
      createdAt: img.message.createdAt,
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
    data: SendMessageInput,
    imageUrls?: string[]
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

    // If replying, verify the reply message exists in this conversation
    let replyTo: ReplyInfo | null = null;
    if (data.replyToId) {
      const replyMessage = await prisma.message.findFirst({
        where: {
          id: data.replyToId,
          conversationId,
        },
        select: {
          id: true,
          content: true,
          senderId: true,
        },
      });

      if (!replyMessage) {
        throw new AppError(404, 'MESSAGE_NOT_FOUND', 'პასუხის მესიჯი ვერ მოიძებნა');
      }

      replyTo = {
        id: replyMessage.id,
        content: replyMessage.content,
        senderId: replyMessage.senderId,
      };
    }

    // Determine last message text for conversation
    const hasImages = imageUrls && imageUrls.length > 0;
    const lastMessageText = data.content
      ? data.content.substring(0, 100)
      : hasImages
        ? '📷 ფოტო'
        : '';

    // Create message and update conversation in transaction
    const result = await prisma.$transaction(async (tx) => {
      const newMessage = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: data.content,
          replyToId: data.replyToId,
        },
      });

      // Create message images if any
      let images: MessageImageInfo[] = [];
      if (hasImages) {
        await tx.messageImage.createMany({
          data: imageUrls.map((url, index) => ({
            messageId: newMessage.id,
            url,
            order: index,
          })),
        });

        images = imageUrls.map((url, index) => ({
          id: '', // Will be populated if needed
          url,
          order: index,
        }));
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: lastMessageText,
          lastMessageSenderId: userId,
          lastMessageAt: new Date(),
        },
      });

      return { message: newMessage, images };
    });

    return {
      id: result.message.id,
      content: result.message.content,
      senderId: result.message.senderId,
      isRead: result.message.isRead,
      isDeleted: false,
      editedAt: null,
      isOwn: true,
      replyTo,
      reactions: [],
      images: result.images,
      createdAt: result.message.createdAt,
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

  /**
   * Add reaction to a message
   */
  async addReaction(
    userId: string,
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<{ messageId: string; emoji: string; userId: string }> {
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

    // Verify message exists in conversation
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
    });

    if (!message) {
      throw new AppError(404, 'MESSAGE_NOT_FOUND', 'მესიჯი ვერ მოიძებნა');
    }

    // Add reaction (upsert to handle duplicates)
    await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      update: {}, // No update needed, just ensure it exists
      create: {
        messageId,
        userId,
        emoji,
      },
    });

    return { messageId, emoji, userId };
  },

  /**
   * Remove reaction from a message
   */
  async removeReaction(
    userId: string,
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<{ messageId: string; emoji: string; userId: string }> {
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

    // Delete reaction (if exists)
    await prisma.messageReaction.deleteMany({
      where: {
        messageId,
        userId,
        emoji,
      },
    });

    return { messageId, emoji, userId };
  },

  /**
   * Get message by ID with reactions
   */
  async getMessage(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<MessageResponse | null> {
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

    const msg = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        id: true,
        content: true,
        senderId: true,
        isRead: true,
        isDeleted: true,
        editedAt: true,
        createdAt: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        images: {
          select: {
            id: true,
            url: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!msg) return null;

    // Group reactions by emoji
    const reactionMap = new Map<string, { count: number; hasReacted: boolean }>();
    msg.reactions.forEach((r) => {
      const existing = reactionMap.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.userId === userId) existing.hasReacted = true;
      } else {
        reactionMap.set(r.emoji, {
          count: 1,
          hasReacted: r.userId === userId,
        });
      }
    });

    const reactions: ReactionInfo[] = Array.from(reactionMap.entries()).map(
      ([emoji, data]) => ({
        emoji,
        count: data.count,
        hasReacted: data.hasReacted,
      })
    );

    return {
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      isRead: msg.isRead,
      isDeleted: msg.isDeleted,
      editedAt: msg.editedAt,
      isOwn: msg.senderId === userId,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            content: msg.replyTo.content,
            senderId: msg.replyTo.senderId,
          }
        : null,
      reactions,
      images: msg.images,
      createdAt: msg.createdAt,
    };
  },

  /**
   * Update a message (only by sender)
   */
  async updateMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    content: string,
    removedImageIds?: string[],
    newImageUrls?: string[]
  ): Promise<MessageResponse> {
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

    // Get the message with current images
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      include: {
        images: {
          select: { id: true },
        },
      },
    });

    if (!message) {
      throw new AppError(404, 'MESSAGE_NOT_FOUND', 'მესიჯი ვერ მოიძებნა');
    }

    // Only sender can edit
    if (message.senderId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'მხოლოდ საკუთარი მესიჯის რედაქტირება შეგიძლიათ');
    }

    // Can't edit deleted messages
    if (message.isDeleted) {
      throw new AppError(400, 'MESSAGE_DELETED', 'წაშლილი მესიჯის რედაქტირება შეუძლებელია');
    }

    // Calculate remaining images after removal
    const currentImageIds = message.images.map(img => img.id);
    const keptImageIds = removedImageIds
      ? currentImageIds.filter(id => !removedImageIds.includes(id))
      : currentImageIds;
    const hasNewImages = newImageUrls && newImageUrls.length > 0;
    const willHaveImages = keptImageIds.length > 0 || hasNewImages;
    const hasContent = content && content.trim().length > 0;

    // Message must have either content or images
    if (!hasContent && !willHaveImages) {
      throw new AppError(400, 'INVALID_MESSAGE', 'მესიჯს უნდა ჰქონდეს ტექსტი ან ფოტო');
    }

    // Perform updates in transaction
    const updatedMessage = await prisma.$transaction(async (tx) => {
      // Delete removed images
      if (removedImageIds && removedImageIds.length > 0) {
        await tx.messageImage.deleteMany({
          where: {
            id: { in: removedImageIds },
            messageId,
          },
        });
      }

      // Add new images
      if (hasNewImages) {
        // Get highest current order
        const maxOrder = keptImageIds.length > 0
          ? await tx.messageImage.findFirst({
              where: { messageId, id: { in: keptImageIds } },
              orderBy: { order: 'desc' },
              select: { order: true },
            })
          : null;
        const startOrder = (maxOrder?.order ?? -1) + 1;

        await tx.messageImage.createMany({
          data: newImageUrls.map((url, index) => ({
            messageId,
            url,
            order: startOrder + index,
          })),
        });
      }

      // Update the message
      return await tx.message.update({
        where: { id: messageId },
        data: {
          content,
          editedAt: new Date(),
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          isRead: true,
          isDeleted: true,
          editedAt: true,
          createdAt: true,
          replyTo: {
            select: {
              id: true,
              content: true,
              senderId: true,
            },
          },
          reactions: {
            select: {
              emoji: true,
              userId: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    // Update conversation last message if this was the last message
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (conversation?.messages[0]?.id === messageId) {
      const lastMessageText = content
        ? content.substring(0, 100)
        : updatedMessage.images.length > 0
          ? '📷 ფოტო'
          : '';
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: lastMessageText,
        },
      });
    }

    // Group reactions
    const reactionMap = new Map<string, { count: number; hasReacted: boolean }>();
    updatedMessage.reactions.forEach((r) => {
      const existing = reactionMap.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.userId === userId) existing.hasReacted = true;
      } else {
        reactionMap.set(r.emoji, {
          count: 1,
          hasReacted: r.userId === userId,
        });
      }
    });

    const reactions: ReactionInfo[] = Array.from(reactionMap.entries()).map(
      ([emoji, data]) => ({
        emoji,
        count: data.count,
        hasReacted: data.hasReacted,
      })
    );

    return {
      id: updatedMessage.id,
      content: updatedMessage.content,
      senderId: updatedMessage.senderId,
      isRead: updatedMessage.isRead,
      isDeleted: updatedMessage.isDeleted,
      editedAt: updatedMessage.editedAt,
      isOwn: true,
      replyTo: updatedMessage.replyTo
        ? {
            id: updatedMessage.replyTo.id,
            content: updatedMessage.replyTo.content,
            senderId: updatedMessage.replyTo.senderId,
          }
        : null,
      reactions,
      images: updatedMessage.images,
      createdAt: updatedMessage.createdAt,
    };
  },

  /**
   * Delete a message (soft delete, only by sender)
   */
  async deleteMessage(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<{ messageId: string }> {
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

    // Get the message
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
    });

    if (!message) {
      throw new AppError(404, 'MESSAGE_NOT_FOUND', 'მესიჯი ვერ მოიძებნა');
    }

    // Only sender can delete
    if (message.senderId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'მხოლოდ საკუთარი მესიჯის წაშლა შეგიძლიათ');
    }

    // Already deleted
    if (message.isDeleted) {
      return { messageId };
    }

    // Soft delete - keep message but mark as deleted and clear content
    await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: '',
      },
    });

    // Delete reactions on this message
    await prisma.messageReaction.deleteMany({
      where: { messageId },
    });

    // Delete images on this message
    await prisma.messageImage.deleteMany({
      where: { messageId },
    });

    // Update conversation last message if this was the last message
    const lastMessage = await prisma.message.findFirst({
      where: {
        conversationId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastMessage) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: lastMessage.content.substring(0, 100),
          lastMessageSenderId: lastMessage.senderId,
          lastMessageAt: lastMessage.createdAt,
        },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: null,
          lastMessageSenderId: null,
          lastMessageAt: null,
        },
      });
    }

    return { messageId };
  },
};
