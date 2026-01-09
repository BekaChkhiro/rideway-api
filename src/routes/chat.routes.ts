import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate } from '../middleware/auth';
import {
  createConversationSchema,
  conversationIdParamSchema,
  sendMessageSchema,
} from '../validators/chat';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Get unread count
router.get('/unread', asyncHandler(chatController.getUnreadCount));

// Get conversations
router.get('/conversations', asyncHandler(chatController.getConversations));

// Create/Get conversation
router.post(
  '/conversations',
  validate(createConversationSchema),
  asyncHandler(chatController.createConversation)
);

// Get messages
router.get(
  '/conversations/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(chatController.getMessages)
);

// Send message
router.post(
  '/conversations/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  validate(sendMessageSchema),
  asyncHandler(chatController.sendMessage)
);

// Mark as read
router.post(
  '/conversations/:id/read',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(chatController.markAsRead)
);

export default router;
