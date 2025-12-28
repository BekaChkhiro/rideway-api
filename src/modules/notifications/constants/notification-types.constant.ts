export enum NotificationType {
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

export interface NotificationTemplate {
  title: string;
  body: string;
}

export const NotificationTemplates: Record<
  NotificationType,
  NotificationTemplate
> = {
  [NotificationType.NEW_FOLLOWER]: {
    title: '{username} started following you',
    body: 'Tap to view their profile',
  },
  [NotificationType.POST_LIKE]: {
    title: '{username} liked your post',
    body: '{postPreview}',
  },
  [NotificationType.POST_COMMENT]: {
    title: '{username} commented on your post',
    body: '{commentPreview}',
  },
  [NotificationType.COMMENT_REPLY]: {
    title: '{username} replied to your comment',
    body: '{replyPreview}',
  },
  [NotificationType.POST_MENTION]: {
    title: '{username} mentioned you in a post',
    body: '{postPreview}',
  },
  [NotificationType.STORY_VIEW]: {
    title: '{username} viewed your story',
    body: 'Tap to see who viewed',
  },
  [NotificationType.THREAD_REPLY]: {
    title: '{username} replied to your thread',
    body: '{replyPreview}',
  },
  [NotificationType.THREAD_LIKE]: {
    title: '{username} liked your thread',
    body: '{threadTitle}',
  },
  [NotificationType.THREAD_MENTION]: {
    title: '{username} mentioned you in a thread',
    body: '{threadPreview}',
  },
  [NotificationType.LISTING_INQUIRY]: {
    title: '{username} inquired about your listing',
    body: '{listingTitle}',
  },
  [NotificationType.LISTING_FAVORITE]: {
    title: '{username} favorited your listing',
    body: '{listingTitle}',
  },
  [NotificationType.NEW_MESSAGE]: {
    title: 'New message from {username}',
    body: '{messagePreview}',
  },
  [NotificationType.SYSTEM_ANNOUNCEMENT]: {
    title: '{title}',
    body: '{body}',
  },
  [NotificationType.ACCOUNT_UPDATE]: {
    title: 'Account Update',
    body: '{body}',
  },
};

// Preference keys that correspond to notification types
export const NotificationPreferenceKeys: Partial<
  Record<NotificationType, string>
> = {
  [NotificationType.NEW_FOLLOWER]: 'newFollower',
  [NotificationType.POST_LIKE]: 'postLike',
  [NotificationType.POST_COMMENT]: 'postComment',
  [NotificationType.COMMENT_REPLY]: 'commentReply',
  [NotificationType.NEW_MESSAGE]: 'newMessage',
  [NotificationType.THREAD_REPLY]: 'threadReply',
  [NotificationType.LISTING_INQUIRY]: 'listingInquiry',
};
