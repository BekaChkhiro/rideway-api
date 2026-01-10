import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { asyncHandler, validate } from '../middleware';
import { authenticate } from '../middleware/auth';
import { uploadChatImages } from '../middleware/upload';
import {
  createConversationSchema,
  conversationIdParamSchema,
  sendMessageSchema,
  updateMessageSchema,
  messageIdParamSchema,
  reactionSchema,
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

// Get media (images) from conversation
router.get(
  '/conversations/:id/media',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(chatController.getMedia)
);

// Send message (with optional images)
router.post(
  '/conversations/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  uploadChatImages,
  asyncHandler(chatController.sendMessage)
);

// Upload images for chat (returns URLs for socket-based sending)
router.post(
  '/conversations/:id/upload',
  validate(conversationIdParamSchema, 'params'),
  uploadChatImages,
  asyncHandler(chatController.uploadImages)
);

// Mark as read
router.post(
  '/conversations/:id/read',
  validate(conversationIdParamSchema, 'params'),
  asyncHandler(chatController.markAsRead)
);

// Add reaction to message
router.post(
  '/conversations/:id/messages/:messageId/reactions',
  validate(conversationIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  validate(reactionSchema),
  asyncHandler(chatController.addReaction)
);

// Remove reaction from message
router.delete(
  '/conversations/:id/messages/:messageId/reactions/:emoji',
  validate(conversationIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  asyncHandler(chatController.removeReaction)
);

// Update message
router.patch(
  '/conversations/:id/messages/:messageId',
  validate(conversationIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  validate(updateMessageSchema),
  asyncHandler(chatController.updateMessage)
);

// Delete message
router.delete(
  '/conversations/:id/messages/:messageId',
  validate(conversationIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  asyncHandler(chatController.deleteMessage)
);

export default router;
