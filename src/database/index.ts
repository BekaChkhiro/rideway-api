export { DatabaseModule } from './database.module.js';
export { BaseEntity } from './entities/base.entity.js';
export { User } from './entities/user.entity.js';
export { UserProfile } from './entities/user-profile.entity.js';
export { UserFollow } from './entities/user-follow.entity.js';
export { UserBlock } from './entities/user-block.entity.js';
export { RefreshToken } from './entities/refresh-token.entity.js';
export { OtpCode, OtpType } from './entities/otp-code.entity.js';
export { UserActivity } from './entities/user-activity.entity.js';
export { DeviceToken, DeviceType } from './entities/device-token.entity.js';

// Chat entities
export {
  Conversation,
  ConversationType,
  ConversationParticipant,
  Message,
  MessageType,
} from '../modules/chat/entities/index.js';

// Notification entities
export {
  Notification,
  NotificationPreferences,
} from '../modules/notifications/entities/index.js';

export { NotificationType } from '../modules/notifications/constants/index.js';
