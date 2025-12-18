# Phase 4: Real-time & Notifications

## Overview

This phase adds real-time capabilities to the application using Socket.io for live features like chat, typing indicators, and online status. We'll also implement a comprehensive notification system with both in-app notifications and Firebase Cloud Messaging for push notifications, powered by BullMQ for reliable background processing.

## Goals

- Implement Socket.io gateway for real-time communication
- Build private messaging system with chat rooms
- Add online status and typing indicators
- Create in-app notification system
- Integrate Firebase Cloud Messaging for push notifications
- Set up BullMQ for background job processing

---

## Tasks

### 4.1 Socket.io Gateway Setup

- [ ] Install and configure Socket.io
- [ ] Create WebSocket gateway
- [ ] Implement JWT authentication for sockets
- [ ] Create connection/disconnection handlers
- [ ] Set up Redis adapter for scaling
- [ ] Implement room management
- [ ] Add error handling and reconnection logic

### 4.2 Chat Module

- [ ] Create conversation entity
- [ ] Create message entity
- [ ] Implement conversation creation (1-to-1)
- [ ] Implement message sending via socket
- [ ] Implement message history endpoint
- [ ] Add read receipts
- [ ] Implement typing indicators
- [ ] Add online status tracking
- [ ] Implement unread count
- [ ] Add message deletion

### 4.3 In-App Notifications

- [ ] Create notification entity
- [ ] Define notification types
- [ ] Implement notification creation service
- [ ] Create notification endpoints
- [ ] Implement real-time notification delivery
- [ ] Add mark as read functionality
- [ ] Implement batch mark all as read
- [ ] Add notification preferences
- [ ] Create notification cleanup job

### 4.4 Push Notifications (FCM)

- [ ] Set up Firebase Admin SDK
- [ ] Create FCM service
- [ ] Implement device token registration
- [ ] Create push notification templates
- [ ] Implement push for different events
- [ ] Add notification preferences check
- [ ] Handle token refresh
- [ ] Implement topic subscriptions

### 4.5 BullMQ Background Jobs

- [ ] Set up BullMQ with Redis
- [ ] Create notification queue
- [ ] Create push notification worker
- [ ] Create email queue (future)
- [ ] Implement job retry logic
- [ ] Add job monitoring
- [ ] Create scheduled jobs (story cleanup, etc.)

---

## Technical Details

### Database Schema

```sql
-- =====================
-- CHAT TABLES
-- =====================

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) DEFAULT 'private', -- private, group (future)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation Participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP,
    is_muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, system
    media_url VARCHAR(500),
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- =====================
-- NOTIFICATION TABLES
-- =====================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    data JSONB, -- Additional data for deep linking
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Device Tokens (for push notifications)
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- ios, android
    device_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- Notification Preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    -- Granular settings
    new_follower BOOLEAN DEFAULT TRUE,
    post_like BOOLEAN DEFAULT TRUE,
    post_comment BOOLEAN DEFAULT TRUE,
    comment_reply BOOLEAN DEFAULT TRUE,
    new_message BOOLEAN DEFAULT TRUE,
    thread_reply BOOLEAN DEFAULT TRUE,
    listing_inquiry BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Online Status (tracked in Redis, persisted for history)
CREATE TABLE user_activity (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMP DEFAULT NOW(),
    is_online BOOLEAN DEFAULT FALSE
);

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
```

### Socket.io Architecture

```typescript
// Socket Events

// Client -> Server
interface ClientToServerEvents {
  // Connection
  'auth': (token: string) => void;

  // Chat
  'join:conversation': (conversationId: string) => void;
  'leave:conversation': (conversationId: string) => void;
  'message:send': (data: { conversationId: string; content: string; type?: string }) => void;
  'message:read': (data: { conversationId: string; messageId: string }) => void;
  'typing:start': (conversationId: string) => void;
  'typing:stop': (conversationId: string) => void;

  // Presence
  'presence:online': () => void;
  'presence:offline': () => void;
}

// Server -> Client
interface ServerToClientEvents {
  // Connection
  'auth:success': (user: UserPayload) => void;
  'auth:error': (error: string) => void;

  // Chat
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (messageId: string) => void;
  'message:read': (data: { userId: string; messageId: string }) => void;
  'typing:update': (data: { conversationId: string; userId: string; isTyping: boolean }) => void;

  // Presence
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;

  // Notifications
  'notification:new': (notification: Notification) => void;
}
```

### Notification Types

```typescript
enum NotificationType {
  // Social
  NEW_FOLLOWER = 'new_follower',
  POST_LIKE = 'post_like',
  POST_COMMENT = 'post_comment',
  COMMENT_REPLY = 'comment_reply',
  POST_MENTION = 'post_mention',
  STORY_VIEW = 'story_view',

  // Forum
  THREAD_REPLY = 'thread_reply',
  THREAD_LIKE = 'thread_like',
  THREAD_MENTION = 'thread_mention',

  // Marketplace
  LISTING_INQUIRY = 'listing_inquiry',
  LISTING_FAVORITE = 'listing_favorite',

  // Chat
  NEW_MESSAGE = 'new_message',

  // System
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  ACCOUNT_UPDATE = 'account_update',
}

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data: {
    entityType: string;  // post, comment, thread, listing, conversation
    entityId: string;
    senderId?: string;
    deepLink?: string;
  };
}
```

### BullMQ Queue Structure

```typescript
// Queue Names
const QUEUES = {
  NOTIFICATIONS: 'notifications',
  PUSH: 'push-notifications',
  EMAIL: 'email',
  CLEANUP: 'cleanup',
};

// Notification Job
interface NotificationJob {
  type: NotificationType;
  recipientId: string;
  senderId?: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string;
}

// Push Job
interface PushNotificationJob {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
  badge?: number;
}

// Cleanup Jobs (scheduled)
interface CleanupJob {
  type: 'expired_stories' | 'old_notifications' | 'inactive_tokens';
}
```

---

## Claude Code Prompts

### Prompt 1: Set Up Socket.io Gateway

```
Set up Socket.io gateway for real-time communication in NestJS:

1. Install required packages:
   - @nestjs/websockets
   - @nestjs/platform-socket.io
   - socket.io
   - @socket.io/redis-adapter

2. Create src/modules/gateway/ directory structure:
   - gateway.module.ts
   - gateway.gateway.ts
   - gateway.service.ts
   - decorators/
     - ws-current-user.decorator.ts
   - guards/
     - ws-auth.guard.ts
   - interfaces/
     - socket-events.interface.ts
     - authenticated-socket.interface.ts

3. Create WebSocket gateway (gateway.gateway.ts):
   - Configure CORS for mobile app
   - Set up namespace: /
   - Implement handleConnection: validate JWT from handshake
   - Implement handleDisconnect: cleanup user status
   - Store socket-to-user mapping in Redis

4. Create gateway service (gateway.service.ts):
   - getUserSocket(userId): Get socket id for user
   - isUserOnline(userId): Check if user is connected
   - emitToUser(userId, event, data): Send to specific user
   - emitToRoom(room, event, data): Send to room
   - getOnlineUsers(userIds): Get online status for users

5. Configure Redis adapter for horizontal scaling:
   - Set up pub/sub for multi-server support
   - Handle room subscriptions across servers

6. Create WS auth guard:
   - Extract token from handshake auth or query
   - Validate JWT token
   - Attach user to socket data
   - Reject invalid connections

7. Create authenticated socket interface:
   interface AuthenticatedSocket extends Socket {
     user: {
       id: string;
       email: string;
       username: string;
     };
   }

8. Add error handling:
   - Invalid token -> disconnect with error
   - Connection error -> emit error event
   - Implement reconnection handling on client

9. Track online users in Redis:
   - Key: online:users (Set)
   - Key: socket:user:{socketId} -> userId
   - Key: user:socket:{userId} -> socketId
```

### Prompt 2: Create Chat Module

```
Create the chat module with private messaging:

1. Create src/modules/chat/ directory structure:
   - chat.module.ts
   - chat.controller.ts
   - chat.service.ts
   - chat.gateway.ts
   - dto/
     - create-conversation.dto.ts
     - send-message.dto.ts
     - message-query.dto.ts
   - entities/
     - conversation.entity.ts
     - conversation-participant.entity.ts
     - message.entity.ts

2. Create entities:
   - Conversation: id, type, createdAt, updatedAt
   - ConversationParticipant: id, conversationId, userId, lastReadAt, isMuted, joinedAt, leftAt
   - Message: id, conversationId, senderId, content, messageType, mediaUrl, isEdited, timestamps

3. Implement ChatService methods:
   - findOrCreateConversation(userId1, userId2): Get or create private chat
   - getConversations(userId): List user's conversations with last message
   - getMessages(conversationId, userId, query): Paginated messages
   - sendMessage(conversationId, senderId, dto): Create and broadcast message
   - markAsRead(conversationId, userId, messageId): Update lastReadAt
   - deleteMessage(messageId, userId): Soft delete
   - muteConversation(conversationId, userId, muted): Toggle mute
   - getUnreadCount(userId): Total unread messages

4. Implement ChatController endpoints (REST):
   GET    /chat/conversations              - List conversations
   POST   /chat/conversations              - Create conversation
   GET    /chat/conversations/:id          - Get conversation
   GET    /chat/conversations/:id/messages - Get messages
   DELETE /chat/messages/:id               - Delete message
   POST   /chat/conversations/:id/mute     - Mute/unmute

5. Implement ChatGateway (WebSocket):

   @SubscribeMessage('join:conversation')
   - Join socket room for conversation
   - Verify user is participant

   @SubscribeMessage('leave:conversation')
   - Leave socket room

   @SubscribeMessage('message:send')
   - Validate user is participant
   - Save message via ChatService
   - Emit 'message:new' to conversation room
   - Trigger notification for offline users

   @SubscribeMessage('message:read')
   - Update lastReadAt
   - Emit 'message:read' to sender

   @SubscribeMessage('typing:start')
   - Emit 'typing:update' to room (exclude sender)

   @SubscribeMessage('typing:stop')
   - Emit 'typing:update' to room

6. Conversation list response format:
   {
     conversations: [
       {
         id,
         participant: { id, username, avatarUrl, isOnline },
         lastMessage: { content, createdAt, isRead },
         unreadCount,
         isMuted
       }
     ]
   }

7. Add blocking check:
   - Cannot create conversation with blocked user
   - Cannot send message to user who blocked you

8. Redis caching:
   - Cache unread counts
   - Cache online status
   - Invalidate on new message
```

### Prompt 3: Implement Online Status and Typing Indicators

```
Implement online status tracking and typing indicators:

1. Update gateway.service.ts for presence:

   setUserOnline(userId):
   - Add to Redis set 'online:users'
   - Set 'user:lastseen:{userId}' to now
   - Broadcast 'user:online' to followers/contacts

   setUserOffline(userId):
   - Remove from Redis set 'online:users'
   - Update 'user:lastseen:{userId}'
   - Update database user_activity table
   - Broadcast 'user:offline' to followers/contacts

   getOnlineStatus(userIds):
   - Check Redis set membership
   - Return map of userId -> isOnline

   getLastSeen(userId):
   - Get from Redis or database
   - Return timestamp

2. Create presence events in gateway:

   handleConnection:
   - After auth, call setUserOnline
   - Join user's personal room: user:{userId}

   handleDisconnect:
   - Call setUserOffline
   - Cleanup socket mappings

3. Implement typing indicators:

   Create typing state in Redis:
   - Key: typing:{conversationId} (Hash)
   - Field: {userId} -> timestamp
   - TTL: 5 seconds

   @SubscribeMessage('typing:start')
   handleTypingStart(socket, conversationId):
   - Verify participant
   - Set typing state in Redis
   - Emit to room (exclude sender):
     { conversationId, userId, isTyping: true }
   - Set auto-expire for typing state

   @SubscribeMessage('typing:stop')
   handleTypingStop(socket, conversationId):
   - Remove typing state from Redis
   - Emit to room:
     { conversationId, userId, isTyping: false }

4. Add API endpoint for online status:

   GET /users/online-status
   - Accept: userIds[] query parameter
   - Return: { [userId]: { isOnline, lastSeen } }

5. Modify user queries to include online status:
   - Add isOnline to user responses where relevant
   - Add lastSeen for offline users

6. Handle edge cases:
   - Multiple devices: user online if ANY device connected
   - Connection drops: implement heartbeat/ping
   - Tab/app backgrounding: send 'presence:offline'

7. Privacy considerations:
   - Respect user privacy settings (future)
   - Only show status to followers/contacts
   - Option to appear offline
```

### Prompt 4: Create Notifications Module

```
Create the in-app notifications module:

1. Create src/modules/notifications/ directory:
   - notifications.module.ts
   - notifications.controller.ts
   - notifications.service.ts
   - notifications.gateway.ts
   - dto/
     - notification-query.dto.ts
     - notification-preferences.dto.ts
   - entities/
     - notification.entity.ts
     - notification-preferences.entity.ts
   - interfaces/
     - notification-payload.interface.ts
   - constants/
     - notification-types.constant.ts

2. Create entities:
   - Notification: id, userId, type, title, body, data (JSONB), isRead, readAt, createdAt
   - NotificationPreferences: id, userId (unique), pushEnabled, emailEnabled, newFollower, postLike, postComment, commentReply, newMessage, threadReply, listingInquiry

3. Define notification types enum and templates:

   NotificationType enum with all types

   NotificationTemplates:
   {
     [NotificationType.NEW_FOLLOWER]: {
       title: '{username} started following you',
       body: 'Tap to view their profile'
     },
     [NotificationType.POST_LIKE]: {
       title: '{username} liked your post',
       body: '{postPreview}'
     },
     // ... etc
   }

4. Implement NotificationsService:

   create(payload: NotificationPayload):
   - Check recipient preferences
   - Create notification record
   - Emit via socket to recipient
   - Queue push notification if offline

   findAll(userId, query):
   - Paginated notifications
   - Filter by read/unread
   - Include sender info

   markAsRead(id, userId):
   - Update isRead and readAt
   - Update unread count cache

   markAllAsRead(userId):
   - Batch update all unread

   getUnreadCount(userId):
   - From cache or database

   updatePreferences(userId, dto):
   - Update notification preferences

   getPreferences(userId):
   - Get or create default preferences

   deleteOld(days):
   - Cleanup job for old notifications

5. Implement NotificationsController:
   GET    /notifications              - List notifications
   GET    /notifications/unread-count - Get count
   POST   /notifications/:id/read     - Mark as read
   POST   /notifications/read-all     - Mark all read
   GET    /notifications/preferences  - Get preferences
   PATCH  /notifications/preferences  - Update preferences

6. Implement NotificationsGateway:

   Emit 'notification:new' when notification created:
   - Only if user is online
   - Include full notification object

7. Create helper methods for each notification type:

   notifyNewFollower(followerId, followedId)
   notifyPostLike(likerId, postId)
   notifyPostComment(commenterId, postId)
   notifyCommentReply(replierId, commentId)
   notifyNewMessage(senderId, conversationId)
   notifyThreadReply(replierId, threadId)
   notifyListingInquiry(inquirerId, listingId)

8. Integrate with other modules:
   - Call notification methods from social, forum, chat services
   - Pass necessary context for deep linking
```

### Prompt 5: Integrate Firebase Cloud Messaging

```
Set up Firebase Cloud Messaging for push notifications:

1. Install Firebase Admin SDK:
   - firebase-admin

2. Create src/modules/notifications/fcm/ directory:
   - fcm.service.ts
   - fcm.config.ts
   - device-tokens.service.ts

3. Create src/config/firebase.config.ts:
   - Load Firebase credentials from environment
   - FIREBASE_PROJECT_ID
   - FIREBASE_PRIVATE_KEY
   - FIREBASE_CLIENT_EMAIL

4. Create DeviceToken entity (device-token.entity.ts):
   - id, userId, token, deviceType (ios/android), deviceName, isActive, timestamps

5. Implement DeviceTokensService:

   register(userId, dto):
   - Upsert device token
   - Mark as active
   - Remove duplicate tokens for same device

   unregister(userId, token):
   - Mark token as inactive

   getActiveTokens(userId):
   - Get all active tokens for user

   removeInvalidTokens(tokens):
   - Cleanup invalid/expired tokens

6. Implement FCMService:

   initialize():
   - Initialize Firebase Admin with credentials

   sendToUser(userId, notification):
   - Get user's active tokens
   - Send to all devices
   - Handle failures (remove invalid tokens)

   sendToTokens(tokens, notification):
   - Multicast to multiple tokens
   - Return success/failure for each

   sendToTopic(topic, notification):
   - Send to topic subscribers

   buildMessage(notification, token):
   - Format for FCM API
   - Include data payload for deep linking
   - Set platform-specific options (iOS/Android)

7. Create push notification payloads:

   interface PushPayload {
     title: string;
     body: string;
     data: {
       type: NotificationType;
       entityType: string;
       entityId: string;
       deepLink: string;
     };
     badge?: number;
     sound?: string;
   }

8. Add device token endpoints to auth or users controller:
   POST   /users/devices          - Register device token
   DELETE /users/devices/:token   - Unregister device token
   GET    /users/devices          - List user's devices

9. Platform-specific configuration:

   iOS:
   - Set apns headers
   - Badge count
   - Sound settings

   Android:
   - Set priority
   - TTL
   - Notification channel

10. Handle token lifecycle:
    - Register on app start
    - Update on token refresh
    - Remove on logout
    - Periodic cleanup of inactive tokens
```

### Prompt 6: Set Up BullMQ for Background Jobs

```
Set up BullMQ for background job processing:

1. Install BullMQ packages:
   - bullmq
   - @nestjs/bullmq

2. Create src/modules/queue/ directory:
   - queue.module.ts
   - processors/
     - notification.processor.ts
     - push.processor.ts
     - cleanup.processor.ts
   - interfaces/
     - job-data.interface.ts

3. Configure BullMQ in queue.module.ts:
   - Connect to Redis
   - Register queues: notifications, push, cleanup
   - Configure default job options

4. Create notification processor:

   @Processor('notifications')
   export class NotificationProcessor {
     @Process()
     async handleNotification(job: Job<NotificationJobData>) {
       // Create in-app notification
       // Check if user online
       // If offline, queue push notification
     }
   }

5. Create push notification processor:

   @Processor('push')
   export class PushProcessor {
     @Process()
     async handlePush(job: Job<PushJobData>) {
       // Check user preferences
       // Get device tokens
       // Send via FCM
       // Handle failures
     }

     @OnQueueFailed()
     handleFailure(job: Job, error: Error) {
       // Log failure
       // Retry logic handled by BullMQ
     }
   }

6. Create cleanup processor with scheduled jobs:

   @Processor('cleanup')
   export class CleanupProcessor {
     @Process('expired-stories')
     async cleanupStories() {
       // Delete expired stories
       // Remove media from R2
     }

     @Process('old-notifications')
     async cleanupNotifications() {
       // Delete notifications older than 30 days
     }

     @Process('inactive-tokens')
     async cleanupTokens() {
       // Remove inactive device tokens
     }
   }

7. Schedule recurring jobs in module initialization:

   async onModuleInit() {
     // Run every hour
     await this.cleanupQueue.add('expired-stories', {}, {
       repeat: { cron: '0 * * * *' }
     });

     // Run daily at 3 AM
     await this.cleanupQueue.add('old-notifications', {}, {
       repeat: { cron: '0 3 * * *' }
     });
   }

8. Create queue service for adding jobs:

   QueueService:
   - addNotificationJob(data): Add to notifications queue
   - addPushJob(data): Add to push queue
   - getJobStatus(queue, jobId): Check job status

9. Configure job options:
   - Retry: 3 attempts with exponential backoff
   - Remove completed jobs after 1 hour
   - Remove failed jobs after 24 hours
   - Priority: push > notifications > cleanup

10. Add Bull Board for monitoring (optional):
    - /admin/queues endpoint
    - Require admin authentication
    - View job status, retry failed jobs

11. Update NotificationsService to use queue:

    Instead of direct notification creation:
    - Add job to notifications queue
    - Let processor handle creation and push
```

---

## Testing Checklist

### Socket.io Gateway Tests

- [ ] Connection with valid JWT succeeds
- [ ] Connection with invalid JWT fails
- [ ] User marked as online on connect
- [ ] User marked as offline on disconnect
- [ ] Multiple connections for same user handled
- [ ] Redis adapter syncs across instances

### Chat Module Tests

- [ ] Create conversation between two users
- [ ] Cannot create conversation with blocked user
- [ ] Send message updates conversation
- [ ] Message broadcast to room participants
- [ ] Mark as read updates lastReadAt
- [ ] Typing indicator emits to room
- [ ] Typing indicator excludes sender
- [ ] Message deletion soft deletes
- [ ] Unread count calculates correctly
- [ ] Mute conversation works

### Online Status Tests

- [ ] Online status updates on connect
- [ ] Offline status updates on disconnect
- [ ] Last seen timestamp accurate
- [ ] Batch online status check works
- [ ] Status broadcast to relevant users

### Notifications Tests

- [ ] Notification created with correct data
- [ ] Notification emitted to online user
- [ ] Notification preferences respected
- [ ] Mark as read updates record
- [ ] Mark all as read works
- [ ] Unread count accurate
- [ ] Old notifications cleaned up

### FCM Tests

- [ ] Device token registration works
- [ ] Push sent to registered devices
- [ ] Invalid tokens removed
- [ ] Platform-specific options applied
- [ ] Notification data includes deep link
- [ ] Preferences prevent push when disabled

### BullMQ Tests

- [ ] Jobs added to correct queue
- [ ] Processor handles jobs correctly
- [ ] Failed jobs retry with backoff
- [ ] Scheduled jobs run on time
- [ ] Job status tracking works
- [ ] Completed jobs cleaned up

### Integration Tests

- [ ] Full flow: action -> notification -> push
- [ ] Chat message -> notification for offline user
- [ ] Follow -> notification with deep link
- [ ] Concurrent connections handled
- [ ] Reconnection restores state

---

## Completion Criteria

Phase 4 is complete when:

1. **Socket.io gateway operational**
   - Authenticated connections
   - Redis adapter for scaling
   - Room management works

2. **Chat fully functional**
   - Private messaging works
   - Real-time delivery
   - Read receipts and typing

3. **Online status working**
   - Accurate online/offline tracking
   - Last seen timestamps
   - Status broadcasts

4. **Notifications system complete**
   - In-app notifications
   - Real-time delivery
   - User preferences

5. **Push notifications working**
   - FCM integration complete
   - Device token management
   - Proper payload formatting

6. **Background jobs running**
   - BullMQ processing jobs
   - Scheduled cleanup tasks
   - Retry logic working

7. **All tests pass**

---

## Notes

- Consider rate limiting for typing events
- Implement message encryption (E2E) if needed
- Monitor Socket.io connection counts
- Set up alerts for failed push notifications
- Consider read receipts privacy settings
- Plan for group chat in future
