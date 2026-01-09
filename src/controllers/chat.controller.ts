import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { CreateConversationInput, SendMessageInput } from '../validators/chat';

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
   * Send a message
   */
  async sendMessage(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = req.body as SendMessageInput;

    const message = await chatService.sendMessage(userId, id, data);

    res.status(201).json({
      success: true,
      data: message,
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
};
