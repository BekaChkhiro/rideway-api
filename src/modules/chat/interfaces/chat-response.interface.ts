export interface ParticipantInfo {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface LastMessageInfo {
  id: string;
  content?: string;
  messageType: string;
  createdAt: Date;
  isRead: boolean;
  senderId?: string;
}

export interface ConversationResponse {
  id: string;
  type: string;
  participant: ParticipantInfo;
  lastMessage?: LastMessageInfo;
  unreadCount: number;
  isMuted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationListResponse {
  conversations: ConversationResponse[];
  total: number;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId?: string;
  sender?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  content?: string;
  messageType: string;
  mediaUrl?: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessagesListResponse {
  messages: MessageResponse[];
  hasMore: boolean;
}

export interface UnreadCountResponse {
  totalUnread: number;
  conversationCounts: Record<string, number>;
}
