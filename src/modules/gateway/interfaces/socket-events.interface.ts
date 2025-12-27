// Client -> Server Events
export interface ClientToServerEvents {
  // Connection
  'auth': (token: string) => void;

  // Chat
  'join:conversation': (conversationId: string) => void;
  'leave:conversation': (conversationId: string) => void;
  'message:send': (data: {
    conversationId: string;
    content: string;
    type?: string;
  }) => void;
  'message:read': (data: { conversationId: string; messageId: string }) => void;
  'typing:start': (conversationId: string) => void;
  'typing:stop': (conversationId: string) => void;

  // Presence
  'presence:online': () => void;
  'presence:offline': () => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  // Connection
  'auth:success': (user: UserPayload) => void;
  'auth:error': (error: string) => void;
  'error': (error: { message: string; code?: string }) => void;

  // Chat
  'message:new': (message: MessagePayload) => void;
  'message:updated': (message: MessagePayload) => void;
  'message:deleted': (messageId: string) => void;
  'message:read': (data: { userId: string; messageId: string }) => void;
  'typing:update': (data: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;

  // Presence
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;

  // Notifications
  'notification:new': (notification: NotificationPayload) => void;
}

// Payload interfaces
export interface UserPayload {
  id: string;
  email: string;
  username?: string;
}

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  mediaUrl?: string;
  createdAt: Date;
  isEdited: boolean;
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}
