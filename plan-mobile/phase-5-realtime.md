# Phase 5: Real-time Features

## Overview

This phase implements real-time features: WebSocket-based chat, push notifications with Firebase Cloud Messaging, online status indicators, and typing indicators.

## Dependencies

```yaml
# pubspec.yaml - Phase 5 additions
dependencies:
  # WebSocket
  socket_io_client: ^2.0.3+1

  # Push Notifications
  firebase_core: ^2.25.4
  firebase_messaging: ^14.7.15
  flutter_local_notifications: ^17.0.0

  # Background handling
  workmanager: ^0.5.2

  # Audio for notifications
  just_audio: ^0.9.36

  # Badges
  flutter_app_badger: ^1.5.0
```

---

## 5.1 Socket.io Client Setup

### Socket Manager

```dart
// lib/core/network/socket_manager.dart
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'socket_manager.g.dart';

enum SocketConnectionStatus {
  disconnected,
  connecting,
  connected,
  reconnecting,
  error,
}

class SocketManager {
  io.Socket? _socket;
  SocketConnectionStatus _status = SocketConnectionStatus.disconnected;
  final List<void Function(SocketConnectionStatus)> _statusListeners = [];
  final Map<String, List<void Function(dynamic)>> _eventListeners = {};

  SocketConnectionStatus get status => _status;

  void connect(String token) {
    if (_socket != null && _socket!.connected) {
      return;
    }

    _updateStatus(SocketConnectionStatus.connecting);

    _socket = io.io(
      EnvConfig.wsUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );

    _setupEventHandlers();
  }

  void _setupEventHandlers() {
    _socket!.onConnect((_) {
      _updateStatus(SocketConnectionStatus.connected);
    });

    _socket!.onDisconnect((_) {
      _updateStatus(SocketConnectionStatus.disconnected);
    });

    _socket!.onConnectError((error) {
      _updateStatus(SocketConnectionStatus.error);
    });

    _socket!.onReconnecting((_) {
      _updateStatus(SocketConnectionStatus.reconnecting);
    });

    _socket!.onReconnect((_) {
      _updateStatus(SocketConnectionStatus.connected);
    });

    // Forward all events to listeners
    _socket!.onAny((event, data) {
      final listeners = _eventListeners[event];
      if (listeners != null) {
        for (final listener in listeners) {
          listener(data);
        }
      }
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _updateStatus(SocketConnectionStatus.disconnected);
  }

  void emit(String event, [dynamic data]) {
    if (_socket?.connected == true) {
      _socket!.emit(event, data);
    }
  }

  void on(String event, void Function(dynamic) callback) {
    _eventListeners.putIfAbsent(event, () => []).add(callback);
  }

  void off(String event, [void Function(dynamic)? callback]) {
    if (callback != null) {
      _eventListeners[event]?.remove(callback);
    } else {
      _eventListeners.remove(event);
    }
  }

  void addStatusListener(void Function(SocketConnectionStatus) listener) {
    _statusListeners.add(listener);
  }

  void removeStatusListener(void Function(SocketConnectionStatus) listener) {
    _statusListeners.remove(listener);
  }

  void _updateStatus(SocketConnectionStatus status) {
    _status = status;
    for (final listener in _statusListeners) {
      listener(status);
    }
  }
}

@riverpod
SocketManager socketManager(SocketManagerRef ref) {
  final manager = SocketManager();

  // Connect when authenticated
  ref.listen(authNotifierProvider, (previous, next) {
    next.whenData((authState) async {
      if (authState.status == AuthStatus.authenticated) {
        final tokens = await ref.read(authRepositoryProvider).getStoredTokens();
        if (tokens != null) {
          manager.connect(tokens.accessToken);
        }
      } else {
        manager.disconnect();
      }
    });
  });

  ref.onDispose(() {
    manager.disconnect();
  });

  return manager;
}

@riverpod
Stream<SocketConnectionStatus> socketConnectionStatus(SocketConnectionStatusRef ref) {
  final manager = ref.watch(socketManagerProvider);
  final controller = StreamController<SocketConnectionStatus>.broadcast();

  void listener(SocketConnectionStatus status) {
    controller.add(status);
  }

  manager.addStatusListener(listener);
  controller.add(manager.status);

  ref.onDispose(() {
    manager.removeStatusListener(listener);
    controller.close();
  });

  return controller.stream;
}
```

---

## 5.2 Chat Domain Layer

### Entities

```dart
// lib/features/chat/domain/entities/conversation.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'conversation.freezed.dart';

@freezed
class Conversation with _$Conversation {
  const factory Conversation({
    required String id,
    required List<User> participants,
    Message? lastMessage,
    @Default(0) int unreadCount,
    @Default(false) bool isMuted,
    @Default(false) bool isBlocked,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _Conversation;

  const Conversation._();

  /// Get the other participant in a 1-on-1 conversation
  User? getOtherParticipant(String currentUserId) {
    return participants.firstWhere(
      (p) => p.id != currentUserId,
      orElse: () => participants.first,
    );
  }

  bool get hasUnread => unreadCount > 0;
}

@freezed
class Message with _$Message {
  const factory Message({
    required String id,
    required String conversationId,
    required String senderId,
    required MessageType type,
    String? content,
    List<MessageAttachment>? attachments,
    Message? replyTo,
    @Default(MessageStatus.sending) MessageStatus status,
    DateTime? readAt,
    required DateTime createdAt,
    DateTime? updatedAt,
    DateTime? deletedAt,
  }) = _Message;

  const Message._();

  bool get isDeleted => deletedAt != null;
  bool get isRead => readAt != null;
}

enum MessageType {
  text,
  image,
  video,
  audio,
  file,
  location,
  listing, // Shared listing
  system,
}

enum MessageStatus {
  sending,
  sent,
  delivered,
  read,
  failed,
}

@freezed
class MessageAttachment with _$MessageAttachment {
  const factory MessageAttachment({
    required String id,
    required String url,
    String? thumbnailUrl,
    required AttachmentType type,
    String? fileName,
    int? fileSize,
    int? width,
    int? height,
    int? duration,
  }) = _MessageAttachment;
}

enum AttachmentType {
  image,
  video,
  audio,
  file,
}

@freezed
class TypingIndicator with _$TypingIndicator {
  const factory TypingIndicator({
    required String conversationId,
    required String userId,
    required DateTime timestamp,
  }) = _TypingIndicator;
}
```

### Repository Interface

```dart
// lib/features/chat/domain/repositories/chat_repository.dart
import 'package:dartz/dartz.dart';

abstract class ChatRepository {
  /// Get all conversations
  Future<Either<Failure, List<Conversation>>> getConversations({
    required int page,
    int limit = 20,
  });

  /// Get or create conversation with user
  Future<Either<Failure, Conversation>> getOrCreateConversation(String userId);

  /// Get conversation by ID
  Future<Either<Failure, Conversation>> getConversation(String id);

  /// Get messages in conversation
  Future<Either<Failure, List<Message>>> getMessages({
    required String conversationId,
    required int page,
    int limit = 50,
    String? beforeMessageId,
  });

  /// Send message
  Future<Either<Failure, Message>> sendMessage(SendMessageRequest request);

  /// Mark messages as read
  Future<Either<Failure, void>> markAsRead(String conversationId);

  /// Delete message
  Future<Either<Failure, void>> deleteMessage(String messageId);

  /// Mute/unmute conversation
  Future<Either<Failure, void>> muteConversation(String conversationId, bool mute);

  /// Block/unblock user
  Future<Either<Failure, void>> blockUser(String userId, bool block);

  /// Upload attachment
  Future<Either<Failure, MessageAttachment>> uploadAttachment(File file);
}
```

---

## 5.3 Chat Presentation Layer

### Chat Providers

```dart
// lib/features/chat/presentation/providers/conversations_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'conversations_provider.g.dart';

@riverpod
class ConversationsNotifier extends _$ConversationsNotifier {
  @override
  FutureOr<List<Conversation>> build() async {
    // Listen for socket events
    final socket = ref.watch(socketManagerProvider);

    socket.on('new_message', (data) {
      _handleNewMessage(Message.fromJson(data));
    });

    socket.on('message_read', (data) {
      _handleMessageRead(data['conversation_id'], data['user_id']);
    });

    ref.onDispose(() {
      socket.off('new_message');
      socket.off('message_read');
    });

    return _fetchConversations();
  }

  Future<List<Conversation>> _fetchConversations() async {
    final repository = ref.read(chatRepositoryProvider);
    final result = await repository.getConversations(page: 1);

    return result.fold(
      (failure) => throw failure,
      (conversations) => conversations,
    );
  }

  void _handleNewMessage(Message message) {
    final currentConversations = state.valueOrNull ?? [];
    final currentUser = ref.read(currentUserProvider);

    final updatedConversations = currentConversations.map((conv) {
      if (conv.id == message.conversationId) {
        return conv.copyWith(
          lastMessage: message,
          updatedAt: message.createdAt,
          unreadCount: message.senderId != currentUser?.id
              ? conv.unreadCount + 1
              : conv.unreadCount,
        );
      }
      return conv;
    }).toList();

    // Sort by last message time
    updatedConversations.sort((a, b) {
      final aTime = a.lastMessage?.createdAt ?? a.createdAt;
      final bTime = b.lastMessage?.createdAt ?? b.createdAt;
      return bTime.compareTo(aTime);
    });

    state = AsyncData(updatedConversations);
  }

  void _handleMessageRead(String conversationId, String userId) {
    final currentConversations = state.valueOrNull ?? [];
    final currentUser = ref.read(currentUserProvider);

    if (userId == currentUser?.id) return;

    state = AsyncData(
      currentConversations.map((conv) {
        if (conv.id == conversationId) {
          return conv.copyWith(
            lastMessage: conv.lastMessage?.copyWith(
              status: MessageStatus.read,
            ),
          );
        }
        return conv;
      }).toList(),
    );
  }

  void markAsRead(String conversationId) {
    final currentConversations = state.valueOrNull ?? [];

    state = AsyncData(
      currentConversations.map((conv) {
        if (conv.id == conversationId) {
          return conv.copyWith(unreadCount: 0);
        }
        return conv;
      }).toList(),
    );

    ref.read(chatRepositoryProvider).markAsRead(conversationId);
    ref.read(socketManagerProvider).emit('mark_read', {
      'conversation_id': conversationId,
    });
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchConversations());
  }
}

// Unread count
@riverpod
int totalUnreadCount(TotalUnreadCountRef ref) {
  final conversationsAsync = ref.watch(conversationsNotifierProvider);

  return conversationsAsync.maybeWhen(
    data: (conversations) => conversations.fold(
      0,
      (sum, conv) => sum + conv.unreadCount,
    ),
    orElse: () => 0,
  );
}
```

```dart
// lib/features/chat/presentation/providers/messages_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'messages_provider.g.dart';

@riverpod
class MessagesNotifier extends _$MessagesNotifier {
  int _page = 1;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  @override
  FutureOr<List<Message>> build(String conversationId) async {
    _page = 1;
    _hasMore = true;

    // Listen for socket events
    final socket = ref.watch(socketManagerProvider);

    socket.on('new_message', (data) {
      final message = Message.fromJson(data);
      if (message.conversationId == conversationId) {
        _handleNewMessage(message);
      }
    });

    socket.on('message_status', (data) {
      if (data['conversation_id'] == conversationId) {
        _handleStatusUpdate(data['message_id'], MessageStatus.values.byName(data['status']));
      }
    });

    socket.on('message_deleted', (data) {
      if (data['conversation_id'] == conversationId) {
        _handleMessageDeleted(data['message_id']);
      }
    });

    ref.onDispose(() {
      socket.off('new_message');
      socket.off('message_status');
      socket.off('message_deleted');
    });

    // Mark as read when opening
    ref.read(conversationsNotifierProvider.notifier).markAsRead(conversationId);

    return _fetchMessages();
  }

  Future<List<Message>> _fetchMessages() async {
    final repository = ref.read(chatRepositoryProvider);
    final result = await repository.getMessages(
      conversationId: arg,
      page: _page,
    );

    return result.fold(
      (failure) => throw failure,
      (messages) {
        if (messages.length < 50) _hasMore = false;
        return messages;
      },
    );
  }

  Future<void> loadMore() async {
    if (!_hasMore || _isLoadingMore) return;

    _isLoadingMore = true;
    _page++;

    final currentMessages = state.valueOrNull ?? [];
    final beforeId = currentMessages.isNotEmpty ? currentMessages.last.id : null;

    final result = await ref.read(chatRepositoryProvider).getMessages(
      conversationId: arg,
      page: _page,
      beforeMessageId: beforeId,
    );

    result.fold(
      (failure) {
        _page--;
        _isLoadingMore = false;
      },
      (newMessages) {
        if (newMessages.length < 50) _hasMore = false;
        state = AsyncData([...currentMessages, ...newMessages]);
        _isLoadingMore = false;
      },
    );
  }

  bool get hasMore => _hasMore;

  void _handleNewMessage(Message message) {
    final currentMessages = state.valueOrNull ?? [];
    state = AsyncData([message, ...currentMessages]);
  }

  void _handleStatusUpdate(String messageId, MessageStatus status) {
    final currentMessages = state.valueOrNull ?? [];
    state = AsyncData(
      currentMessages.map((msg) {
        if (msg.id == messageId) {
          return msg.copyWith(status: status);
        }
        return msg;
      }).toList(),
    );
  }

  void _handleMessageDeleted(String messageId) {
    final currentMessages = state.valueOrNull ?? [];
    state = AsyncData(
      currentMessages.map((msg) {
        if (msg.id == messageId) {
          return msg.copyWith(deletedAt: DateTime.now());
        }
        return msg;
      }).toList(),
    );
  }

  Future<void> sendMessage({
    required String content,
    MessageType type = MessageType.text,
    List<File>? attachments,
    Message? replyTo,
  }) async {
    final currentUser = ref.read(currentUserProvider);
    if (currentUser == null) return;

    // Create optimistic message
    final optimisticMessage = Message(
      id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: arg,
      senderId: currentUser.id,
      type: type,
      content: content,
      replyTo: replyTo,
      status: MessageStatus.sending,
      createdAt: DateTime.now(),
    );

    // Add to state immediately
    final currentMessages = state.valueOrNull ?? [];
    state = AsyncData([optimisticMessage, ...currentMessages]);

    // Upload attachments if any
    List<MessageAttachment>? uploadedAttachments;
    if (attachments != null && attachments.isNotEmpty) {
      uploadedAttachments = [];
      for (final file in attachments) {
        final result = await ref.read(chatRepositoryProvider).uploadAttachment(file);
        result.fold(
          (failure) => null,
          (attachment) => uploadedAttachments!.add(attachment),
        );
      }
    }

    // Send via repository and socket
    final request = SendMessageRequest(
      conversationId: arg,
      type: type,
      content: content,
      attachments: uploadedAttachments,
      replyToId: replyTo?.id,
    );

    final result = await ref.read(chatRepositoryProvider).sendMessage(request);

    result.fold(
      (failure) {
        // Mark message as failed
        state = AsyncData(
          currentMessages.map((msg) {
            if (msg.id == optimisticMessage.id) {
              return msg.copyWith(status: MessageStatus.failed);
            }
            return msg;
          }).toList(),
        );
      },
      (sentMessage) {
        // Replace optimistic message with real one
        state = AsyncData(
          state.value!.map((msg) {
            if (msg.id == optimisticMessage.id) {
              return sentMessage;
            }
            return msg;
          }).toList(),
        );
      },
    );
  }

  Future<void> deleteMessage(String messageId) async {
    final result = await ref.read(chatRepositoryProvider).deleteMessage(messageId);

    result.fold(
      (failure) => null,
      (_) {
        _handleMessageDeleted(messageId);
      },
    );
  }

  Future<void> resendMessage(Message message) async {
    // Remove failed message
    final currentMessages = state.valueOrNull ?? [];
    state = AsyncData(currentMessages.where((m) => m.id != message.id).toList());

    // Resend
    await sendMessage(
      content: message.content ?? '',
      type: message.type,
      replyTo: message.replyTo,
    );
  }
}

// Typing indicator
@riverpod
class TypingNotifier extends _$TypingNotifier {
  Timer? _typingTimer;
  Timer? _sendTimer;
  bool _isTyping = false;

  @override
  List<TypingIndicator> build(String conversationId) {
    final socket = ref.watch(socketManagerProvider);

    socket.on('user_typing', (data) {
      if (data['conversation_id'] == conversationId) {
        _handleUserTyping(data);
      }
    });

    socket.on('user_stop_typing', (data) {
      if (data['conversation_id'] == conversationId) {
        _handleUserStopTyping(data['user_id']);
      }
    });

    ref.onDispose(() {
      socket.off('user_typing');
      socket.off('user_stop_typing');
      _typingTimer?.cancel();
      _sendTimer?.cancel();
    });

    return [];
  }

  void _handleUserTyping(Map<String, dynamic> data) {
    final userId = data['user_id'] as String;
    final currentUser = ref.read(currentUserProvider);

    if (userId == currentUser?.id) return;

    final indicator = TypingIndicator(
      conversationId: arg,
      userId: userId,
      timestamp: DateTime.now(),
    );

    final currentIndicators = state.where((i) => i.userId != userId).toList();
    state = [...currentIndicators, indicator];

    // Auto-remove after 3 seconds
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 3), () {
      _handleUserStopTyping(userId);
    });
  }

  void _handleUserStopTyping(String userId) {
    state = state.where((i) => i.userId != userId).toList();
  }

  void startTyping() {
    if (_isTyping) return;

    _isTyping = true;
    ref.read(socketManagerProvider).emit('start_typing', {
      'conversation_id': arg,
    });

    // Send typing every 2 seconds while typing
    _sendTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (_isTyping) {
        ref.read(socketManagerProvider).emit('start_typing', {
          'conversation_id': arg,
        });
      }
    });
  }

  void stopTyping() {
    if (!_isTyping) return;

    _isTyping = false;
    _sendTimer?.cancel();
    ref.read(socketManagerProvider).emit('stop_typing', {
      'conversation_id': arg,
    });
  }
}
```

### Conversations List Screen

```dart
// lib/features/chat/presentation/screens/conversations_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsAsync = ref.watch(conversationsNotifierProvider);
    final connectionStatus = ref.watch(socketConnectionStatusProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_square),
            onPressed: () => context.push('/chat/new'),
          ),
        ],
        bottom: connectionStatus.maybeWhen(
          data: (status) {
            if (status != SocketConnectionStatus.connected) {
              return PreferredSize(
                preferredSize: const Size.fromHeight(24),
                child: Container(
                  color: status == SocketConnectionStatus.connecting ||
                          status == SocketConnectionStatus.reconnecting
                      ? Colors.orange
                      : Colors.red,
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Center(
                    child: Text(
                      status == SocketConnectionStatus.connecting
                          ? 'Connecting...'
                          : status == SocketConnectionStatus.reconnecting
                              ? 'Reconnecting...'
                              : 'Disconnected',
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                ),
              );
            }
            return null;
          },
          orElse: () => null,
        ),
      ),
      body: conversationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Failed to load conversations'),
              ElevatedButton(
                onPressed: () => ref.invalidate(conversationsNotifierProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (conversations) {
          if (conversations.isEmpty) {
            return const _EmptyConversations();
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(conversationsNotifierProvider.notifier).refresh(),
            child: ListView.builder(
              itemCount: conversations.length,
              itemBuilder: (context, index) {
                return _ConversationItem(conversation: conversations[index]);
              },
            ),
          );
        },
      ),
    );
  }
}

class _ConversationItem extends ConsumerWidget {
  final Conversation conversation;

  const _ConversationItem({required this.conversation});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider);
    final otherUser = conversation.getOtherParticipant(currentUser?.id ?? '');
    final typingIndicators = ref.watch(typingNotifierProvider(conversation.id));
    final isTyping = typingIndicators.isNotEmpty;
    final onlineStatus = ref.watch(userOnlineStatusProvider(otherUser?.id ?? ''));

    return ListTile(
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundImage: otherUser?.avatarUrl != null
                ? CachedNetworkImageProvider(otherUser!.avatarUrl!)
                : null,
            child: otherUser?.avatarUrl == null
                ? Text(otherUser?.username[0].toUpperCase() ?? 'U')
                : null,
          ),
          // Online indicator
          if (onlineStatus.valueOrNull == true)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: Colors.green,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    width: 2,
                  ),
                ),
              ),
            ),
        ],
      ),
      title: Row(
        children: [
          Text(
            otherUser?.displayName ?? 'Unknown',
            style: TextStyle(
              fontWeight: conversation.hasUnread ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          if (otherUser?.isVerified == true) ...[
            const SizedBox(width: 4),
            const Icon(
              Icons.verified,
              color: AppColors.primary,
              size: 14,
            ),
          ],
        ],
      ),
      subtitle: isTyping
          ? Text(
              'Typing...',
              style: TextStyle(
                color: AppColors.primary,
                fontStyle: FontStyle.italic,
              ),
            )
          : Text(
              _getLastMessagePreview(conversation.lastMessage, currentUser?.id),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: conversation.hasUnread
                    ? Theme.of(context).textTheme.bodyLarge?.color
                    : AppColors.textSecondary,
                fontWeight: conversation.hasUnread ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            _formatTime(conversation.lastMessage?.createdAt ?? conversation.createdAt),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: conversation.hasUnread ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
          if (conversation.hasUnread) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                conversation.unreadCount > 99
                    ? '99+'
                    : conversation.unreadCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
      onTap: () => context.push('/chat/${conversation.id}'),
      onLongPress: () => _showConversationOptions(context, ref),
    );
  }

  String _getLastMessagePreview(Message? message, String? currentUserId) {
    if (message == null) return 'Start a conversation';
    if (message.isDeleted) return 'Message deleted';

    final prefix = message.senderId == currentUserId ? 'You: ' : '';

    switch (message.type) {
      case MessageType.text:
        return '$prefix${message.content}';
      case MessageType.image:
        return '$prefix📷 Photo';
      case MessageType.video:
        return '$prefix🎥 Video';
      case MessageType.audio:
        return '$prefix🎵 Audio';
      case MessageType.file:
        return '$prefix📎 File';
      case MessageType.location:
        return '$prefix📍 Location';
      case MessageType.listing:
        return '$prefix🏍️ Listing';
      case MessageType.system:
        return message.content ?? 'System message';
    }
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);

    if (difference.inDays > 7) {
      return '${time.day}/${time.month}';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m';
    } else {
      return 'Now';
    }
  }

  void _showConversationOptions(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(
                conversation.isMuted ? Icons.notifications : Icons.notifications_off,
              ),
              title: Text(conversation.isMuted ? 'Unmute' : 'Mute'),
              onTap: () {
                Navigator.pop(context);
                ref.read(chatRepositoryProvider).muteConversation(
                  conversation.id,
                  !conversation.isMuted,
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Delete conversation'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Delete conversation
              },
            ),
          ],
        ),
      ),
    );
  }
}
```

### Chat Screen

```dart
// lib/features/chat/presentation/screens/chat_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const ChatScreen({
    super.key,
    required this.conversationId,
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();
  Message? _replyingTo;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _messageController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 100) {
      ref.read(messagesNotifierProvider(widget.conversationId).notifier).loadMore();
    }
  }

  void _onTextChanged() {
    if (_messageController.text.isNotEmpty) {
      ref.read(typingNotifierProvider(widget.conversationId).notifier).startTyping();
    } else {
      ref.read(typingNotifierProvider(widget.conversationId).notifier).stopTyping();
    }
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(messagesNotifierProvider(widget.conversationId));
    final conversationAsync = ref.watch(conversationDetailProvider(widget.conversationId));
    final currentUser = ref.watch(currentUserProvider);
    final typingIndicators = ref.watch(typingNotifierProvider(widget.conversationId));

    return conversationAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Failed to load conversation')),
      ),
      data: (conversation) {
        if (conversation == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Conversation not found')),
          );
        }

        final otherUser = conversation.getOtherParticipant(currentUser?.id ?? '');

        return Scaffold(
          appBar: AppBar(
            titleSpacing: 0,
            title: GestureDetector(
              onTap: () => context.push('/profile/${otherUser?.id}'),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundImage: otherUser?.avatarUrl != null
                        ? CachedNetworkImageProvider(otherUser!.avatarUrl!)
                        : null,
                    child: otherUser?.avatarUrl == null
                        ? Text(otherUser?.username[0].toUpperCase() ?? 'U')
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        otherUser?.displayName ?? 'Unknown',
                        style: const TextStyle(fontSize: 16),
                      ),
                      if (typingIndicators.isNotEmpty)
                        const Text(
                          'Typing...',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.primary,
                          ),
                        )
                      else
                        _OnlineStatusText(userId: otherUser?.id ?? ''),
                    ],
                  ),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.call),
                onPressed: () {
                  // TODO: Call
                },
              ),
              IconButton(
                icon: const Icon(Icons.more_vert),
                onPressed: () => _showChatOptions(context),
              ),
            ],
          ),
          body: Column(
            children: [
              // Messages
              Expanded(
                child: messagesAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (_, __) => const Center(child: Text('Failed to load messages')),
                  data: (messages) {
                    if (messages.isEmpty) {
                      return const Center(
                        child: Text('No messages yet. Say hello!'),
                      );
                    }

                    return ListView.builder(
                      controller: _scrollController,
                      reverse: true,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final message = messages[index];
                        final previousMessage = index < messages.length - 1
                            ? messages[index + 1]
                            : null;
                        final nextMessage = index > 0 ? messages[index - 1] : null;

                        final showAvatar = nextMessage == null ||
                            nextMessage.senderId != message.senderId;
                        final showDate = previousMessage == null ||
                            !_isSameDay(message.createdAt, previousMessage.createdAt);

                        return Column(
                          children: [
                            if (showDate)
                              _DateDivider(date: message.createdAt),
                            MessageBubble(
                              message: message,
                              isMe: message.senderId == currentUser?.id,
                              showAvatar: showAvatar,
                              onReply: () => setState(() => _replyingTo = message),
                              onResend: message.status == MessageStatus.failed
                                  ? () => ref
                                      .read(messagesNotifierProvider(widget.conversationId).notifier)
                                      .resendMessage(message)
                                  : null,
                            ),
                          ],
                        );
                      },
                    );
                  },
                ),
              ),

              // Reply preview
              if (_replyingTo != null)
                _ReplyPreview(
                  message: _replyingTo!,
                  onCancel: () => setState(() => _replyingTo = null),
                ),

              // Input
              SafeArea(
                child: _MessageInput(
                  controller: _messageController,
                  focusNode: _focusNode,
                  onSend: _sendMessage,
                  onAttachment: _pickAttachment,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  void _sendMessage() {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    ref.read(messagesNotifierProvider(widget.conversationId).notifier).sendMessage(
      content: content,
      replyTo: _replyingTo,
    );

    _messageController.clear();
    setState(() => _replyingTo = null);
    ref.read(typingNotifierProvider(widget.conversationId).notifier).stopTyping();
  }

  void _pickAttachment() async {
    final picker = ImagePicker();

    final result = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Gallery'),
              onTap: () => Navigator.pop(context, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file),
              title: const Text('File'),
              onTap: () => Navigator.pop(context, 'file'),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    File? file;
    MessageType type = MessageType.image;

    switch (result) {
      case 'camera':
        final photo = await picker.pickImage(source: ImageSource.camera);
        if (photo != null) file = File(photo.path);
        break;
      case 'gallery':
        final photo = await picker.pickImage(source: ImageSource.gallery);
        if (photo != null) file = File(photo.path);
        break;
      case 'file':
        // TODO: File picker
        break;
    }

    if (file != null) {
      ref.read(messagesNotifierProvider(widget.conversationId).notifier).sendMessage(
        content: '',
        type: type,
        attachments: [file],
      );
    }
  }

  void _showChatOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.notifications_off),
              title: const Text('Mute'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Mute
              },
            ),
            ListTile(
              leading: const Icon(Icons.search),
              title: const Text('Search'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Search messages
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('Block user'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Block
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _OnlineStatusText extends ConsumerWidget {
  final String userId;

  const _OnlineStatusText({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onlineStatus = ref.watch(userOnlineStatusProvider(userId));
    final lastSeen = ref.watch(userLastSeenProvider(userId));

    return onlineStatus.when(
      loading: () => const Text(
        'Loading...',
        style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      error: (_, __) => const SizedBox(),
      data: (isOnline) {
        if (isOnline) {
          return const Text(
            'Online',
            style: TextStyle(fontSize: 12, color: Colors.green),
          );
        }

        return lastSeen.maybeWhen(
          data: (time) => Text(
            'Last seen ${_formatLastSeen(time)}',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          orElse: () => const Text(
            'Offline',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        );
      },
    );
  }

  String _formatLastSeen(DateTime? time) {
    if (time == null) return 'recently';

    final difference = DateTime.now().difference(time);
    if (difference.inMinutes < 1) return 'just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m ago';
    if (difference.inHours < 24) return '${difference.inHours}h ago';
    if (difference.inDays < 7) return '${difference.inDays}d ago';
    return '${time.day}/${time.month}';
  }
}
```

### Message Bubble Widget

```dart
// lib/features/chat/presentation/widgets/message_bubble.dart
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;
  final bool showAvatar;
  final VoidCallback onReply;
  final VoidCallback? onResend;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.showAvatar,
    required this.onReply,
    this.onResend,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        top: 2,
        bottom: showAvatar ? 8 : 2,
      ),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe && showAvatar) ...[
            const CircleAvatar(radius: 14),
            const SizedBox(width: 8),
          ] else if (!isMe) ...[
            const SizedBox(width: 36),
          ],

          GestureDetector(
            onLongPress: () => _showMessageOptions(context),
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              child: Column(
                crossAxisAlignment:
                    isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  // Reply preview
                  if (message.replyTo != null)
                    _ReplyBubble(
                      message: message.replyTo!,
                      isMe: isMe,
                    ),

                  // Message content
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: message.isDeleted
                          ? Colors.grey.withOpacity(0.2)
                          : isMe
                              ? AppColors.primary
                              : AppColors.surface,
                      borderRadius: BorderRadius.circular(16).copyWith(
                        bottomRight: isMe && showAvatar
                            ? const Radius.circular(4)
                            : null,
                        bottomLeft: !isMe && showAvatar
                            ? const Radius.circular(4)
                            : null,
                      ),
                    ),
                    child: _buildContent(context),
                  ),

                  // Status indicators
                  if (isMe && !message.isDeleted)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _formatTime(message.createdAt),
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(width: 4),
                          _StatusIcon(status: message.status),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (message.isDeleted) {
      return Text(
        'This message was deleted',
        style: TextStyle(
          fontStyle: FontStyle.italic,
          color: AppColors.textSecondary,
        ),
      );
    }

    switch (message.type) {
      case MessageType.text:
        return Text(
          message.content ?? '',
          style: TextStyle(
            color: isMe ? Colors.white : null,
          ),
        );

      case MessageType.image:
        return _ImageMessage(
          attachment: message.attachments!.first,
        );

      case MessageType.video:
        return _VideoMessage(
          attachment: message.attachments!.first,
        );

      case MessageType.location:
        return _LocationMessage(message: message);

      case MessageType.listing:
        return _ListingMessage(message: message);

      default:
        return Text(message.content ?? '');
    }
  }

  void _showMessageOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(context);
                onReply();
              },
            ),
            if (message.type == MessageType.text)
              ListTile(
                leading: const Icon(Icons.copy),
                title: const Text('Copy'),
                onTap: () {
                  Navigator.pop(context);
                  Clipboard.setData(ClipboardData(text: message.content ?? ''));
                },
              ),
            if (message.status == MessageStatus.failed && onResend != null)
              ListTile(
                leading: const Icon(Icons.refresh),
                title: const Text('Retry'),
                onTap: () {
                  Navigator.pop(context);
                  onResend!();
                },
              ),
            if (isMe && !message.isDeleted)
              ListTile(
                leading: const Icon(Icons.delete),
                title: const Text('Delete'),
                onTap: () {
                  Navigator.pop(context);
                  // TODO: Delete message
                },
              ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}

class _StatusIcon extends StatelessWidget {
  final MessageStatus status;

  const _StatusIcon({required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case MessageStatus.sending:
        return const SizedBox(
          width: 12,
          height: 12,
          child: CircularProgressIndicator(strokeWidth: 1),
        );
      case MessageStatus.sent:
        return const Icon(Icons.check, size: 12, color: AppColors.textSecondary);
      case MessageStatus.delivered:
        return const Icon(Icons.done_all, size: 12, color: AppColors.textSecondary);
      case MessageStatus.read:
        return const Icon(Icons.done_all, size: 12, color: AppColors.primary);
      case MessageStatus.failed:
        return const Icon(Icons.error, size: 12, color: Colors.red);
    }
  }
}
```

---

## 5.4 Push Notifications

### FCM Setup

```dart
// lib/core/notifications/notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'notification_service.g.dart';

class NotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  String? _fcmToken;

  Future<void> initialize() async {
    // Request permission
    await _requestPermission();

    // Initialize local notifications
    await _initializeLocalNotifications();

    // Get FCM token
    _fcmToken = await _fcm.getToken();
    debugPrint('FCM Token: $_fcmToken');

    // Listen for token refresh
    _fcm.onTokenRefresh.listen((token) {
      _fcmToken = token;
      _updateTokenOnServer(token);
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Handle notification taps
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check for initial notification (app opened from notification)
    final initialMessage = await _fcm.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  Future<void> _requestPermission() async {
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    debugPrint('FCM Permission: ${settings.authorizationStatus}');
  }

  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _localNotifications.initialize(
      const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
      onDidReceiveNotificationResponse: (response) {
        _handleLocalNotificationTap(response);
      },
    );

    // Create notification channels for Android
    await _createNotificationChannels();
  }

  Future<void> _createNotificationChannels() async {
    const channels = [
      AndroidNotificationChannel(
        'messages',
        'Messages',
        description: 'New message notifications',
        importance: Importance.high,
      ),
      AndroidNotificationChannel(
        'social',
        'Social',
        description: 'Likes, comments, follows',
        importance: Importance.defaultImportance,
      ),
      AndroidNotificationChannel(
        'marketplace',
        'Marketplace',
        description: 'Listing updates',
        importance: Importance.defaultImportance,
      ),
      AndroidNotificationChannel(
        'forum',
        'Forum',
        description: 'Thread replies',
        importance: Importance.low,
      ),
    ];

    for (final channel in channels) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('Foreground message: ${message.data}');

    // Don't show notification if user is in the relevant chat
    // This would need to check current route

    _showLocalNotification(message);
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    final data = message.data;

    if (notification == null) return;

    final channel = _getChannelForType(data['type'] ?? 'default');

    await _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: channel.importance,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncode(data),
    );
  }

  AndroidNotificationChannel _getChannelForType(String type) {
    switch (type) {
      case 'message':
        return const AndroidNotificationChannel(
          'messages',
          'Messages',
          importance: Importance.high,
        );
      case 'like':
      case 'comment':
      case 'follow':
        return const AndroidNotificationChannel(
          'social',
          'Social',
          importance: Importance.defaultImportance,
        );
      case 'listing':
        return const AndroidNotificationChannel(
          'marketplace',
          'Marketplace',
          importance: Importance.defaultImportance,
        );
      default:
        return const AndroidNotificationChannel(
          'default',
          'Default',
          importance: Importance.defaultImportance,
        );
    }
  }

  void _handleNotificationTap(RemoteMessage message) {
    final data = message.data;
    _navigateToScreen(data);
  }

  void _handleLocalNotificationTap(NotificationResponse response) {
    if (response.payload == null) return;

    final data = jsonDecode(response.payload!) as Map<String, dynamic>;
    _navigateToScreen(data);
  }

  void _navigateToScreen(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    final id = data['id'] as String?;

    switch (type) {
      case 'message':
        // Navigate to chat
        navigatorKey.currentState?.pushNamed('/chat/$id');
        break;
      case 'post':
        navigatorKey.currentState?.pushNamed('/post/$id');
        break;
      case 'listing':
        navigatorKey.currentState?.pushNamed('/marketplace/$id');
        break;
      case 'profile':
        navigatorKey.currentState?.pushNamed('/profile/$id');
        break;
      default:
        break;
    }
  }

  Future<void> _updateTokenOnServer(String token) async {
    // TODO: Update token on server
  }

  String? get fcmToken => _fcmToken;

  Future<void> subscribeToTopic(String topic) async {
    await _fcm.subscribeToTopic(topic);
  }

  Future<void> unsubscribeFromTopic(String topic) async {
    await _fcm.unsubscribeFromTopic(topic);
  }
}

// Background handler must be top-level
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('Background message: ${message.data}');
}

@riverpod
NotificationService notificationService(NotificationServiceRef ref) {
  final service = NotificationService();
  service.initialize();
  return service;
}
```

### Notification Settings

```dart
// lib/features/notifications/presentation/screens/notification_settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(notificationSettingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
      ),
      body: settings.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load settings')),
        data: (prefs) => ListView(
          children: [
            _SectionHeader(title: 'Push Notifications'),

            SwitchListTile(
              title: const Text('Enable Push Notifications'),
              subtitle: const Text('Receive notifications on your device'),
              value: prefs.pushEnabled,
              onChanged: (value) {
                ref.read(notificationSettingsProvider.notifier)
                    .updatePushEnabled(value);
              },
            ),

            const Divider(),

            _SectionHeader(title: 'Messages'),

            SwitchListTile(
              title: const Text('New Messages'),
              value: prefs.newMessages,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateNewMessages(value);
                    }
                  : null,
            ),

            SwitchListTile(
              title: const Text('Message Requests'),
              value: prefs.messageRequests,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateMessageRequests(value);
                    }
                  : null,
            ),

            const Divider(),

            _SectionHeader(title: 'Social'),

            SwitchListTile(
              title: const Text('Likes'),
              value: prefs.likes,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateLikes(value);
                    }
                  : null,
            ),

            SwitchListTile(
              title: const Text('Comments'),
              value: prefs.comments,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateComments(value);
                    }
                  : null,
            ),

            SwitchListTile(
              title: const Text('New Followers'),
              value: prefs.newFollowers,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateNewFollowers(value);
                    }
                  : null,
            ),

            SwitchListTile(
              title: const Text('Mentions'),
              value: prefs.mentions,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateMentions(value);
                    }
                  : null,
            ),

            const Divider(),

            _SectionHeader(title: 'Marketplace'),

            SwitchListTile(
              title: const Text('Listing Messages'),
              value: prefs.listingMessages,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateListingMessages(value);
                    }
                  : null,
            ),

            SwitchListTile(
              title: const Text('Price Drops'),
              value: prefs.priceDrops,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updatePriceDrops(value);
                    }
                  : null,
            ),

            const Divider(),

            _SectionHeader(title: 'Forum'),

            SwitchListTile(
              title: const Text('Thread Replies'),
              value: prefs.threadReplies,
              onChanged: prefs.pushEnabled
                  ? (value) {
                      ref.read(notificationSettingsProvider.notifier)
                          .updateThreadReplies(value);
                    }
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 5.5 Online Status

### Online Status Provider

```dart
// lib/features/chat/presentation/providers/online_status_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'online_status_provider.g.dart';

@riverpod
class OnlineStatusManager extends _$OnlineStatusManager {
  final Map<String, bool> _statusCache = {};
  final Map<String, DateTime?> _lastSeenCache = {};

  @override
  void build() {
    final socket = ref.watch(socketManagerProvider);

    socket.on('user_online', (data) {
      _statusCache[data['user_id']] = true;
      _lastSeenCache[data['user_id']] = null;
      ref.invalidateSelf();
    });

    socket.on('user_offline', (data) {
      _statusCache[data['user_id']] = false;
      _lastSeenCache[data['user_id']] = DateTime.now();
      ref.invalidateSelf();
    });

    ref.onDispose(() {
      socket.off('user_online');
      socket.off('user_offline');
    });
  }

  bool isOnline(String userId) => _statusCache[userId] ?? false;
  DateTime? lastSeen(String userId) => _lastSeenCache[userId];
}

@riverpod
FutureOr<bool> userOnlineStatus(UserOnlineStatusRef ref, String userId) {
  final manager = ref.watch(onlineStatusManagerProvider);
  return manager.isOnline(userId);
}

@riverpod
FutureOr<DateTime?> userLastSeen(UserLastSeenRef ref, String userId) {
  final manager = ref.watch(onlineStatusManagerProvider);
  return manager.lastSeen(userId);
}
```

---

## Testing Checklist

### Socket Tests
- [ ] Socket connects on login
- [ ] Socket reconnects after disconnection
- [ ] Socket disconnects on logout
- [ ] Connection status indicator works

### Chat Tests
- [ ] Conversations load
- [ ] Messages load and paginate
- [ ] Send text message
- [ ] Send image/video
- [ ] Receive messages in real-time
- [ ] Typing indicator shows
- [ ] Message status (sent, delivered, read)
- [ ] Reply to message
- [ ] Delete message
- [ ] Mute conversation

### Notification Tests
- [ ] FCM token generated
- [ ] Foreground notifications show
- [ ] Background notifications work
- [ ] Notification tap navigates correctly
- [ ] Notification settings work
- [ ] Badge count updates

### Online Status Tests
- [ ] Online indicator shows
- [ ] Last seen updates
- [ ] Status updates in real-time

---

## Claude Code Prompts

### Prompt: Socket Manager
```
Create Socket.io manager for Flutter with:
1. Connection with JWT auth
2. Auto-reconnection
3. Event listeners pattern
4. Connection status provider
5. Riverpod integration for lifecycle
```

### Prompt: Chat Screen
```
Create chat screen with:
1. AppBar with user info and online status
2. Messages list (reversed, newest at bottom)
3. Date dividers between messages
4. Message bubbles with status indicators
5. Typing indicator
6. Input field with attachment button
7. Reply functionality
8. Long-press options (copy, reply, delete)
```

### Prompt: Push Notifications
```
Set up Firebase Cloud Messaging with:
1. Permission request
2. Token management
3. Foreground and background handlers
4. Local notification display
5. Notification channels for Android
6. Tap handling with navigation
7. Settings screen for preferences
```

### Prompt: Online Status
```
Implement online status system with:
1. Socket events for online/offline
2. Status cache in provider
3. Last seen tracking
4. Real-time updates
5. UI indicators (green dot, "Online", "Last seen")
```
