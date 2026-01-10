import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { uploadFiles } from '../services/media.service';
import { CreateConversationInput, SendMessageInput, UpdateMessageInput, ReactionInput } from '../validators/chat';
import { AppError } from '../middleware/error-handler';

export const chatController = {
  /**
   * Get user's conversations
   */
  async getConversations(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));

    const result = await chatService.getConversations(userId, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  /**
   * Create or get existing conversation with user
   */
  async createConversation(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { participantId } = req.body as CreateConversationInput;

    const conversation = await chatService.getOrCreateConversation(userId, participantId);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));

    const result = await chatService.getMessages(userId, id, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  /**
   * Get media from a conversation
   */
  async getMedia(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));

    const result = await chatService.getMedia(userId, id, pageNum, limitNum);

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  },

  /**
   * Send a message (with optional images)
   */
  async sendMessage(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as SendMessageInput;
    const files = req.files as Express.Multer.File[] | undefined;

    // Upload images if any
    let imageUrls: string[] | undefined;
    if (files && files.length > 0) {
      const uploadResults = await uploadFiles(files, 'chat', userId);
      imageUrls = uploadResults.map((r) => r.url);
    }

    // Validate that there's content or images
    if (!data.content && (!imageUrls || imageUrls.length === 0)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'შეტყობინება ან ფოტო აუცილებელია');
    }

    const message = await chatService.sendMessage(userId, id, data, imageUrls);

    res.status(201).json({
      success: true,
      data: message,
    });
  },

  /**
   * Upload images for chat (returns URLs for socket-based sending)
   */
  async uploadImages(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;

    // Verify user is participant (basic check)
    // The actual participant check will happen when sending the message

    if (!files || files.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ფოტო აუცილებელია');
    }

    const uploadResults = await uploadFiles(files, 'chat', userId);
    const urls = uploadResults.map((r) => r.url);

    res.status(201).json({
      success: true,
      data: { urls, conversationId: id },
    });
  },

  /**
   * Mark conversation as read
   */
  async markAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;

    await chatService.markAsRead(userId, id);

    res.json({
      success: true,
      data: { message: 'წაკითხულად მონიშნულია' },
    });
  },

  /**
   * Get total unread messages count
   */
  async getUnreadCount(req: Request, res: Response) {
    const userId = req.user!.userId;

    const count = await chatService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  },

  /**
   * Add reaction to a message
   */
  async addReaction(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: conversationId, messageId } = req.params;
    const { emoji } = req.body as ReactionInput;

    const reaction = await chatService.addReaction(userId, conversationId, messageId, emoji);

    res.status(201).json({
      success: true,
      data: reaction,
    });
  },

  /**
   * Remove reaction from a message
   */
  async removeReaction(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: conversationId, messageId, emoji } = req.params;

    await chatService.removeReaction(userId, conversationId, messageId, decodeURIComponent(emoji));

    res.json({
      success: true,
      data: { message: 'რეაქცია წაშლილია' },
    });
  },

  /**
   * Update a message
   */
  async updateMessage(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: conversationId, messageId } = req.params;
    const { content } = req.body as UpdateMessageInput;

    const message = await chatService.updateMessage(userId, conversationId, messageId, content);

    res.json({
      success: true,
      data: message,
    });
  },

  /**
   * Delete a message
   */
  async deleteMessage(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id: conversationId, messageId } = req.params;

    const result = await chatService.deleteMessage(userId, conversationId, messageId);

    res.json({
      success: true,
      data: result,
    });
  },
};
