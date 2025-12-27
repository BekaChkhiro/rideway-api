# Phase 3: Social Features

## Overview

This phase implements the social features of Bike Area: feed, posts, stories, comments, likes, and sharing. These are the core engagement features that keep users coming back.

## Dependencies

```yaml
# pubspec.yaml - Phase 3 additions
dependencies:
  # Video player
  video_player: ^2.8.2
  chewie: ^1.7.4

  # Stories
  story_view: ^0.16.0

  # Carousel
  carousel_slider: ^4.2.1

  # Full screen image viewer
  photo_view: ^0.14.0

  # Share
  share_plus: ^7.2.1

  # Mention & hashtag
  flutter_mentions: ^2.0.1
```

---

## 3.1 Post Domain Layer

### Entities

```dart
// lib/features/feed/domain/entities/post.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'post.freezed.dart';

@freezed
class Post with _$Post {
  const factory Post({
    required String id,
    required User author,
    String? content,
    required List<PostMedia> media,
    required PostType type,
    @Default(0) int likesCount,
    @Default(0) int commentsCount,
    @Default(0) int sharesCount,
    @Default(false) bool isLiked,
    @Default(false) bool isSaved,
    Location? location,
    List<String>? hashtags,
    List<UserMention>? mentions,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _Post;

  const Post._();

  bool get hasMedia => media.isNotEmpty;
  bool get hasMultipleMedia => media.length > 1;
  bool get isVideo => media.isNotEmpty && media.first.type == MediaType.video;
}

enum PostType {
  regular,
  story,
  reel,
}

@freezed
class PostMedia with _$PostMedia {
  const factory PostMedia({
    required String id,
    required String url,
    String? thumbnailUrl,
    required MediaType type,
    int? width,
    int? height,
    int? duration, // in seconds for video
  }) = _PostMedia;
}

enum MediaType {
  image,
  video,
}

@freezed
class Location with _$Location {
  const factory Location({
    required double latitude,
    required double longitude,
    String? name,
    String? address,
  }) = _Location;
}

@freezed
class UserMention with _$UserMention {
  const factory UserMention({
    required String userId,
    required String username,
    required int startIndex,
    required int endIndex,
  }) = _UserMention;
}
```

```dart
// lib/features/feed/domain/entities/story.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'story.freezed.dart';

@freezed
class Story with _$Story {
  const factory Story({
    required String id,
    required User author,
    required List<StoryItem> items,
    @Default(false) bool hasUnseenItems,
    required DateTime createdAt,
    required DateTime expiresAt,
  }) = _Story;
}

@freezed
class StoryItem with _$StoryItem {
  const factory StoryItem({
    required String id,
    required String mediaUrl,
    String? thumbnailUrl,
    required MediaType type,
    int? duration, // in seconds
    @Default(false) bool isSeen,
    String? caption,
    List<StorySticker>? stickers,
    required DateTime createdAt,
  }) = _StoryItem;
}

@freezed
class StorySticker with _$StorySticker {
  const factory StorySticker({
    required String type, // text, mention, location, poll, etc.
    required double x,
    required double y,
    required double scale,
    required double rotation,
    required Map<String, dynamic> data,
  }) = _StorySticker;
}
```

### Repository Interface

```dart
// lib/features/feed/domain/repositories/feed_repository.dart
import 'package:dartz/dartz.dart';

abstract class FeedRepository {
  /// Get personalized feed
  Future<Either<Failure, List<Post>>> getFeed({
    required int page,
    int limit = 10,
  });

  /// Get user's posts
  Future<Either<Failure, List<Post>>> getUserPosts({
    required String userId,
    required int page,
    int limit = 20,
  });

  /// Get single post
  Future<Either<Failure, Post>> getPost(String postId);

  /// Create new post
  Future<Either<Failure, Post>> createPost(CreatePostRequest request);

  /// Delete post
  Future<Either<Failure, void>> deletePost(String postId);

  /// Like post
  Future<Either<Failure, void>> likePost(String postId);

  /// Unlike post
  Future<Either<Failure, void>> unlikePost(String postId);

  /// Save post
  Future<Either<Failure, void>> savePost(String postId);

  /// Unsave post
  Future<Either<Failure, void>> unsavePost(String postId);

  /// Get saved posts
  Future<Either<Failure, List<Post>>> getSavedPosts({
    required int page,
    int limit = 20,
  });

  /// Get post likes
  Future<Either<Failure, List<User>>> getPostLikes({
    required String postId,
    required int page,
    int limit = 50,
  });

  /// Report post
  Future<Either<Failure, void>> reportPost(String postId, String reason);
}
```

---

## 3.2 Feed Data Layer

### Models

```dart
// lib/features/feed/data/models/post_model.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'post_model.freezed.dart';
part 'post_model.g.dart';

@freezed
class PostModel with _$PostModel {
  const factory PostModel({
    required String id,
    required UserModel author,
    String? content,
    required List<PostMediaModel> media,
    required String type,
    @JsonKey(name: 'likes_count') @Default(0) int likesCount,
    @JsonKey(name: 'comments_count') @Default(0) int commentsCount,
    @JsonKey(name: 'shares_count') @Default(0) int sharesCount,
    @JsonKey(name: 'is_liked') @Default(false) bool isLiked,
    @JsonKey(name: 'is_saved') @Default(false) bool isSaved,
    LocationModel? location,
    List<String>? hashtags,
    List<UserMentionModel>? mentions,
    @JsonKey(name: 'created_at') required DateTime createdAt,
    @JsonKey(name: 'updated_at') DateTime? updatedAt,
  }) = _PostModel;

  factory PostModel.fromJson(Map<String, dynamic> json) =>
      _$PostModelFromJson(json);
}

extension PostModelX on PostModel {
  Post toEntity() => Post(
    id: id,
    author: author.toEntity(),
    content: content,
    media: media.map((m) => m.toEntity()).toList(),
    type: PostType.values.firstWhere(
      (t) => t.name == type,
      orElse: () => PostType.regular,
    ),
    likesCount: likesCount,
    commentsCount: commentsCount,
    sharesCount: sharesCount,
    isLiked: isLiked,
    isSaved: isSaved,
    location: location?.toEntity(),
    hashtags: hashtags,
    mentions: mentions?.map((m) => m.toEntity()).toList(),
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}

@freezed
class PostMediaModel with _$PostMediaModel {
  const factory PostMediaModel({
    required String id,
    required String url,
    @JsonKey(name: 'thumbnail_url') String? thumbnailUrl,
    required String type,
    int? width,
    int? height,
    int? duration,
  }) = _PostMediaModel;

  factory PostMediaModel.fromJson(Map<String, dynamic> json) =>
      _$PostMediaModelFromJson(json);
}

extension PostMediaModelX on PostMediaModel {
  PostMedia toEntity() => PostMedia(
    id: id,
    url: url,
    thumbnailUrl: thumbnailUrl,
    type: type == 'video' ? MediaType.video : MediaType.image,
    width: width,
    height: height,
    duration: duration,
  );
}
```

### Data Source

```dart
// lib/features/feed/data/datasources/feed_remote_datasource.dart
abstract class FeedRemoteDataSource {
  Future<List<PostModel>> getFeed({required int page, int limit = 10});
  Future<List<PostModel>> getUserPosts({
    required String userId,
    required int page,
    int limit = 20,
  });
  Future<PostModel> getPost(String postId);
  Future<PostModel> createPost(CreatePostRequest request);
  Future<void> deletePost(String postId);
  Future<void> likePost(String postId);
  Future<void> unlikePost(String postId);
  Future<void> savePost(String postId);
  Future<void> unsavePost(String postId);
  Future<List<PostModel>> getSavedPosts({required int page, int limit = 20});
  Future<List<UserModel>> getPostLikes({
    required String postId,
    required int page,
    int limit = 50,
  });
  Future<void> reportPost(String postId, String reason);
}

class FeedRemoteDataSourceImpl implements FeedRemoteDataSource {
  final ApiClient _client;

  FeedRemoteDataSourceImpl(this._client);

  @override
  Future<List<PostModel>> getFeed({required int page, int limit = 10}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/feed',
      queryParameters: {'page': page, 'limit': limit},
    );
    final List<dynamic> items = response['data'];
    return items.map((json) => PostModel.fromJson(json)).toList();
  }

  @override
  Future<PostModel> createPost(CreatePostRequest request) async {
    // Upload media first
    final mediaUrls = <Map<String, dynamic>>[];

    for (final file in request.files) {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path),
        'type': request.isVideo ? 'video' : 'image',
      });

      final uploadResponse = await _client.upload<Map<String, dynamic>>(
        '/media/upload',
        formData,
      );
      mediaUrls.add(uploadResponse);
    }

    // Create post with uploaded media
    final response = await _client.post<Map<String, dynamic>>(
      '/posts',
      data: {
        'content': request.content,
        'media': mediaUrls,
        'location': request.location?.toJson(),
        'hashtags': request.hashtags,
        'mentions': request.mentions?.map((m) => m.toJson()).toList(),
      },
    );

    return PostModel.fromJson(response);
  }

  @override
  Future<void> likePost(String postId) async {
    await _client.post('/posts/$postId/like');
  }

  @override
  Future<void> unlikePost(String postId) async {
    await _client.delete('/posts/$postId/like');
  }

  // ... other methods
}
```

---

## 3.3 Feed Presentation Layer

### Feed Provider

```dart
// lib/features/feed/presentation/providers/feed_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'feed_provider.g.dart';

@riverpod
class FeedNotifier extends _$FeedNotifier {
  int _page = 1;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  @override
  FutureOr<List<Post>> build() async {
    _page = 1;
    _hasMore = true;
    return _fetchFeed();
  }

  Future<List<Post>> _fetchFeed() async {
    final repository = ref.read(feedRepositoryProvider);
    final result = await repository.getFeed(page: _page);

    return result.fold(
      (failure) => throw failure,
      (posts) {
        if (posts.length < 10) _hasMore = false;
        return posts;
      },
    );
  }

  Future<void> refresh() async {
    _page = 1;
    _hasMore = true;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _fetchFeed());
  }

  Future<void> loadMore() async {
    if (!_hasMore || _isLoadingMore) return;

    _isLoadingMore = true;
    _page++;

    final currentPosts = state.valueOrNull ?? [];
    final result = await ref.read(feedRepositoryProvider).getFeed(page: _page);

    result.fold(
      (failure) {
        _page--;
        _isLoadingMore = false;
      },
      (newPosts) {
        if (newPosts.length < 10) _hasMore = false;
        state = AsyncData([...currentPosts, ...newPosts]);
        _isLoadingMore = false;
      },
    );
  }

  bool get hasMore => _hasMore;

  /// Optimistic like update
  void likePost(String postId) {
    _updatePostInState(postId, (post) => post.copyWith(
      isLiked: true,
      likesCount: post.likesCount + 1,
    ));

    ref.read(feedRepositoryProvider).likePost(postId).then((result) {
      result.fold(
        (failure) => _updatePostInState(postId, (post) => post.copyWith(
          isLiked: false,
          likesCount: post.likesCount - 1,
        )),
        (_) => null,
      );
    });
  }

  void unlikePost(String postId) {
    _updatePostInState(postId, (post) => post.copyWith(
      isLiked: false,
      likesCount: post.likesCount - 1,
    ));

    ref.read(feedRepositoryProvider).unlikePost(postId).then((result) {
      result.fold(
        (failure) => _updatePostInState(postId, (post) => post.copyWith(
          isLiked: true,
          likesCount: post.likesCount + 1,
        )),
        (_) => null,
      );
    });
  }

  void savePost(String postId) {
    _updatePostInState(postId, (post) => post.copyWith(isSaved: true));
    ref.read(feedRepositoryProvider).savePost(postId);
  }

  void unsavePost(String postId) {
    _updatePostInState(postId, (post) => post.copyWith(isSaved: false));
    ref.read(feedRepositoryProvider).unsavePost(postId);
  }

  void removePost(String postId) {
    final currentPosts = state.valueOrNull ?? [];
    state = AsyncData(currentPosts.where((p) => p.id != postId).toList());
  }

  void _updatePostInState(String postId, Post Function(Post) update) {
    final currentPosts = state.valueOrNull ?? [];
    state = AsyncData(
      currentPosts.map((post) {
        if (post.id == postId) {
          return update(post);
        }
        return post;
      }).toList(),
    );
  }
}
```

### Feed Screen

```dart
// lib/features/feed/presentation/screens/feed_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(feedNotifierProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final feedAsync = ref.watch(feedNotifierProvider);
    final storiesAsync = ref.watch(storiesNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: Image.asset(
          'assets/images/logo.png',
          height: 32,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_box_outlined),
            onPressed: () => context.push('/create-post'),
          ),
          IconButton(
            icon: const Icon(Icons.favorite_border),
            onPressed: () => context.push('/activity'),
          ),
          IconButton(
            icon: const Icon(Icons.send_outlined),
            onPressed: () => context.push('/messages'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            ref.read(feedNotifierProvider.notifier).refresh(),
            ref.read(storiesNotifierProvider.notifier).refresh(),
          ]);
        },
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            // Stories
            SliverToBoxAdapter(
              child: storiesAsync.when(
                loading: () => const StoriesShimmer(),
                error: (_, __) => const SizedBox(),
                data: (stories) => StoriesBar(stories: stories),
              ),
            ),

            // Divider
            const SliverToBoxAdapter(
              child: Divider(height: 1),
            ),

            // Feed
            feedAsync.when(
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, stack) => SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('Failed to load feed'),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(feedNotifierProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (posts) {
                if (posts.isEmpty) {
                  return const SliverFillRemaining(
                    child: EmptyFeed(),
                  );
                }

                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index >= posts.length) {
                        return const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }

                      return PostCard(
                        post: posts[index],
                        onLike: () {
                          final notifier = ref.read(feedNotifierProvider.notifier);
                          if (posts[index].isLiked) {
                            notifier.unlikePost(posts[index].id);
                          } else {
                            notifier.likePost(posts[index].id);
                          }
                        },
                        onSave: () {
                          final notifier = ref.read(feedNotifierProvider.notifier);
                          if (posts[index].isSaved) {
                            notifier.unsavePost(posts[index].id);
                          } else {
                            notifier.savePost(posts[index].id);
                          }
                        },
                      );
                    },
                    childCount: posts.length + (ref.read(feedNotifierProvider.notifier).hasMore ? 1 : 0),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class EmptyFeed extends StatelessWidget {
  const EmptyFeed({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 64,
            color: AppColors.textSecondary.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'Your feed is empty',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Follow people to see their posts here',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => context.push('/discover'),
            child: const Text('Discover People'),
          ),
        ],
      ),
    );
  }
}
```

### Post Card Widget

```dart
// lib/features/feed/presentation/widgets/post_card.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:go_router/go_router.dart';

class PostCard extends StatelessWidget {
  final Post post;
  final VoidCallback onLike;
  final VoidCallback onSave;

  const PostCard({
    super.key,
    required this.post,
    required this.onLike,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        _PostHeader(post: post),

        // Media
        if (post.hasMedia)
          _PostMedia(post: post, onDoubleTap: onLike),

        // Actions
        _PostActions(
          post: post,
          onLike: onLike,
          onSave: onSave,
        ),

        // Likes count
        if (post.likesCount > 0)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GestureDetector(
              onTap: () => context.push('/post/${post.id}/likes'),
              child: Text(
                '${_formatCount(post.likesCount)} likes',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),

        // Content
        if (post.content != null && post.content!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: RichText(
              text: TextSpan(
                style: Theme.of(context).textTheme.bodyMedium,
                children: [
                  TextSpan(
                    text: post.author.username,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const TextSpan(text: ' '),
                  TextSpan(text: post.content),
                ],
              ),
            ),
          ),

        // Comments link
        if (post.commentsCount > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: GestureDetector(
              onTap: () => context.push('/post/${post.id}/comments'),
              child: Text(
                'View all ${post.commentsCount} comments',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
          ),

        // Timestamp
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Text(
            _formatTimeAgo(post.createdAt),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  String _formatTimeAgo(DateTime dateTime) {
    final difference = DateTime.now().difference(dateTime);

    if (difference.inDays > 7) {
      return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}

class _PostHeader extends StatelessWidget {
  final Post post;

  const _PostHeader({required this.post});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.push('/profile/${post.author.id}'),
            child: CircleAvatar(
              radius: 18,
              backgroundImage: post.author.avatarUrl != null
                  ? CachedNetworkImageProvider(post.author.avatarUrl!)
                  : null,
              child: post.author.avatarUrl == null
                  ? Text(post.author.username[0].toUpperCase())
                  : null,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => context.push('/profile/${post.author.id}'),
                      child: Text(
                        post.author.username,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (post.author.isVerified) ...[
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.verified,
                        color: AppColors.primary,
                        size: 14,
                      ),
                    ],
                  ],
                ),
                if (post.location != null)
                  Text(
                    post.location!.name ?? '',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.more_horiz),
            onPressed: () => _showPostOptions(context),
          ),
        ],
      ),
    );
  }

  void _showPostOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.share),
              title: const Text('Share'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Share post
              },
            ),
            ListTile(
              leading: const Icon(Icons.link),
              title: const Text('Copy link'),
              onTap: () {
                Navigator.pop(context);
                Clipboard.setData(
                  ClipboardData(text: 'https://bikearea.ge/post/${post.id}'),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Link copied')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: const Text('Report'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Report post
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PostMedia extends StatefulWidget {
  final Post post;
  final VoidCallback onDoubleTap;

  const _PostMedia({
    required this.post,
    required this.onDoubleTap,
  });

  @override
  State<_PostMedia> createState() => _PostMediaState();
}

class _PostMediaState extends State<_PostMedia> {
  int _currentIndex = 0;
  bool _showLikeAnimation = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onDoubleTap: () {
        widget.onDoubleTap();
        setState(() => _showLikeAnimation = true);
        HapticFeedback.lightImpact();

        Future.delayed(const Duration(milliseconds: 800), () {
          if (mounted) {
            setState(() => _showLikeAnimation = false);
          }
        });
      },
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (widget.post.hasMultipleMedia)
            CarouselSlider.builder(
              itemCount: widget.post.media.length,
              options: CarouselOptions(
                viewportFraction: 1.0,
                aspectRatio: 1.0,
                enableInfiniteScroll: false,
                onPageChanged: (index, _) {
                  setState(() => _currentIndex = index);
                },
              ),
              itemBuilder: (context, index, _) {
                return _MediaItem(media: widget.post.media[index]);
              },
            )
          else
            _MediaItem(media: widget.post.media.first),

          // Like animation
          AnimatedOpacity(
            opacity: _showLikeAnimation ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 200),
            child: const Icon(
              Icons.favorite,
              color: Colors.white,
              size: 80,
            ),
          ),

          // Carousel indicator
          if (widget.post.hasMultipleMedia)
            Positioned(
              bottom: 8,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  widget.post.media.length,
                  (index) => Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _currentIndex == index
                          ? AppColors.primary
                          : Colors.white.withOpacity(0.5),
                    ),
                  ),
                ),
              ),
            ),

          // Page indicator (top right)
          if (widget.post.hasMultipleMedia)
            Positioned(
              top: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_currentIndex + 1}/${widget.post.media.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MediaItem extends StatelessWidget {
  final PostMedia media;

  const _MediaItem({required this.media});

  @override
  Widget build(BuildContext context) {
    if (media.type == MediaType.video) {
      return VideoPostPlayer(
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
      );
    }

    return CachedNetworkImage(
      imageUrl: media.url,
      fit: BoxFit.cover,
      width: double.infinity,
      placeholder: (context, url) => AspectRatio(
        aspectRatio: 1,
        child: Container(
          color: AppColors.surface,
          child: const Center(child: CircularProgressIndicator()),
        ),
      ),
      errorWidget: (context, url, error) => AspectRatio(
        aspectRatio: 1,
        child: Container(
          color: AppColors.surface,
          child: const Icon(Icons.error),
        ),
      ),
    );
  }
}

class _PostActions extends StatelessWidget {
  final Post post;
  final VoidCallback onLike;
  final VoidCallback onSave;

  const _PostActions({
    required this.post,
    required this.onLike,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
            icon: Icon(
              post.isLiked ? Icons.favorite : Icons.favorite_border,
              color: post.isLiked ? Colors.red : null,
            ),
            onPressed: onLike,
          ),
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline),
            onPressed: () => context.push('/post/${post.id}/comments'),
          ),
          IconButton(
            icon: const Icon(Icons.send_outlined),
            onPressed: () {
              // TODO: Share post
            },
          ),
          const Spacer(),
          IconButton(
            icon: Icon(
              post.isSaved ? Icons.bookmark : Icons.bookmark_border,
            ),
            onPressed: onSave,
          ),
        ],
      ),
    );
  }
}
```

---

## 3.4 Stories

### Stories Provider

```dart
// lib/features/feed/presentation/providers/stories_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'stories_provider.g.dart';

@riverpod
class StoriesNotifier extends _$StoriesNotifier {
  @override
  FutureOr<List<Story>> build() async {
    final repository = ref.read(storyRepositoryProvider);
    final result = await repository.getStories();

    return result.fold(
      (failure) => throw failure,
      (stories) => stories,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    final repository = ref.read(storyRepositoryProvider);
    final result = await repository.getStories();

    state = result.fold(
      (failure) => AsyncError(failure, StackTrace.current),
      (stories) => AsyncData(stories),
    );
  }

  void markAsSeen(String storyId, String itemId) {
    final currentStories = state.valueOrNull ?? [];
    state = AsyncData(
      currentStories.map((story) {
        if (story.id == storyId) {
          return story.copyWith(
            items: story.items.map((item) {
              if (item.id == itemId) {
                return item.copyWith(isSeen: true);
              }
              return item;
            }).toList(),
            hasUnseenItems: story.items.where((i) => !i.isSeen && i.id != itemId).isNotEmpty,
          );
        }
        return story;
      }).toList(),
    );

    // API call to mark as seen
    ref.read(storyRepositoryProvider).markAsSeen(storyId, itemId);
  }
}
```

### Stories Bar Widget

```dart
// lib/features/feed/presentation/widgets/stories_bar.dart
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';

class StoriesBar extends StatelessWidget {
  final List<Story> stories;

  const StoriesBar({super.key, required this.stories});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 110,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        itemCount: stories.length + 1, // +1 for "Add Story"
        itemBuilder: (context, index) {
          if (index == 0) {
            return const _AddStoryItem();
          }

          final story = stories[index - 1];
          return _StoryItem(
            story: story,
            onTap: () => context.push('/stories', extra: stories.skip(index - 1).toList()),
          );
        },
      ),
    );
  }
}

class _AddStoryItem extends ConsumerWidget {
  const _AddStoryItem();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: GestureDetector(
        onTap: () => context.push('/create-story'),
        child: Column(
          children: [
            Stack(
              children: [
                CircleAvatar(
                  radius: 34,
                  backgroundColor: AppColors.surface,
                  backgroundImage: currentUser?.avatarUrl != null
                      ? CachedNetworkImageProvider(currentUser!.avatarUrl!)
                      : null,
                  child: currentUser?.avatarUrl == null
                      ? Text(
                          currentUser?.username[0].toUpperCase() ?? 'U',
                          style: const TextStyle(fontSize: 24),
                        )
                      : null,
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Theme.of(context).scaffoldBackgroundColor,
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.add,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Your Story',
              style: TextStyle(fontSize: 12),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _StoryItem extends StatelessWidget {
  final Story story;
  final VoidCallback onTap;

  const _StoryItem({
    required this.story,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: story.hasUnseenItems
                    ? const LinearGradient(
                        colors: [
                          Color(0xFFF58529),
                          Color(0xFFDD2A7B),
                          Color(0xFF8134AF),
                          Color(0xFF515BD4),
                        ],
                        begin: Alignment.topRight,
                        end: Alignment.bottomLeft,
                      )
                    : null,
                border: story.hasUnseenItems
                    ? null
                    : Border.all(color: AppColors.border, width: 2),
              ),
              child: CircleAvatar(
                radius: 31,
                backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                child: CircleAvatar(
                  radius: 29,
                  backgroundImage: story.author.avatarUrl != null
                      ? CachedNetworkImageProvider(story.author.avatarUrl!)
                      : null,
                  child: story.author.avatarUrl == null
                      ? Text(
                          story.author.username[0].toUpperCase(),
                          style: const TextStyle(fontSize: 20),
                        )
                      : null,
                ),
              ),
            ),
            const SizedBox(height: 6),
            SizedBox(
              width: 70,
              child: Text(
                story.author.username,
                style: const TextStyle(fontSize: 12),
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

### Story Viewer Screen

```dart
// lib/features/feed/presentation/screens/story_viewer_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:story_view/story_view.dart';
import 'package:cached_network_image/cached_network_image.dart';

class StoryViewerScreen extends ConsumerStatefulWidget {
  final List<Story> stories;

  const StoryViewerScreen({
    super.key,
    required this.stories,
  });

  @override
  ConsumerState<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends ConsumerState<StoryViewerScreen> {
  late PageController _pageController;
  late List<StoryController> _storyControllers;
  int _currentStoryIndex = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _storyControllers = widget.stories.map((_) => StoryController()).toList();
  }

  @override
  void dispose() {
    _pageController.dispose();
    for (final controller in _storyControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: PageView.builder(
        controller: _pageController,
        itemCount: widget.stories.length,
        onPageChanged: (index) {
          setState(() => _currentStoryIndex = index);
        },
        itemBuilder: (context, index) {
          final story = widget.stories[index];
          final controller = _storyControllers[index];

          return _StoryPage(
            story: story,
            controller: controller,
            onComplete: () {
              if (index < widget.stories.length - 1) {
                _pageController.nextPage(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                );
              } else {
                Navigator.pop(context);
              }
            },
            onItemViewed: (itemId) {
              ref.read(storiesNotifierProvider.notifier).markAsSeen(
                story.id,
                itemId,
              );
            },
          );
        },
      ),
    );
  }
}

class _StoryPage extends StatefulWidget {
  final Story story;
  final StoryController controller;
  final VoidCallback onComplete;
  final void Function(String itemId) onItemViewed;

  const _StoryPage({
    required this.story,
    required this.controller,
    required this.onComplete,
    required this.onItemViewed,
  });

  @override
  State<_StoryPage> createState() => _StoryPageState();
}

class _StoryPageState extends State<_StoryPage> {
  late List<StoryItem> _storyItems;

  @override
  void initState() {
    super.initState();
    _buildStoryItems();
  }

  void _buildStoryItems() {
    _storyItems = widget.story.items.map((item) {
      if (item.type == MediaType.video) {
        return StoryItem.pageVideo(
          item.mediaUrl,
          controller: widget.controller,
          caption: item.caption != null
              ? Text(
                  item.caption!,
                  style: const TextStyle(color: Colors.white),
                )
              : null,
          duration: Duration(seconds: item.duration ?? 15),
        );
      } else {
        return StoryItem.pageImage(
          url: item.mediaUrl,
          controller: widget.controller,
          caption: item.caption != null
              ? Text(
                  item.caption!,
                  style: const TextStyle(color: Colors.white),
                )
              : null,
          duration: const Duration(seconds: 5),
        );
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        StoryView(
          storyItems: _storyItems,
          controller: widget.controller,
          onComplete: widget.onComplete,
          onStoryShow: (storyItem) {
            final index = _storyItems.indexOf(storyItem);
            if (index >= 0 && index < widget.story.items.length) {
              widget.onItemViewed(widget.story.items[index].id);
            }
          },
          progressPosition: ProgressPosition.top,
          repeat: false,
        ),

        // Header
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 48, 16, 0),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => context.push('/profile/${widget.story.author.id}'),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundImage: widget.story.author.avatarUrl != null
                        ? CachedNetworkImageProvider(widget.story.author.avatarUrl!)
                        : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.story.author.username,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        _formatTimeAgo(widget.story.createdAt),
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        ),

        // Reply input
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        hintText: 'Reply to ${widget.story.author.username}...',
                        hintStyle: TextStyle(color: Colors.white.withOpacity(0.7)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: Colors.white.withOpacity(0.3)),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                      ),
                      onTap: () {
                        widget.controller.pause();
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.favorite_border, color: Colors.white),
                    onPressed: () {
                      // TODO: Like story
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.send_outlined, color: Colors.white),
                    onPressed: () {
                      // TODO: Share story
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _formatTimeAgo(DateTime dateTime) {
    final difference = DateTime.now().difference(dateTime);
    if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}
```

---

## 3.5 Comments

### Comment Entity

```dart
// lib/features/feed/domain/entities/comment.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'comment.freezed.dart';

@freezed
class Comment with _$Comment {
  const factory Comment({
    required String id,
    required String postId,
    required User author,
    required String content,
    String? parentId, // For replies
    @Default(0) int likesCount,
    @Default(0) int repliesCount,
    @Default(false) bool isLiked,
    List<UserMention>? mentions,
    required DateTime createdAt,
  }) = _Comment;
}
```

### Comments Provider

```dart
// lib/features/feed/presentation/providers/comments_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'comments_provider.g.dart';

@riverpod
class CommentsNotifier extends _$CommentsNotifier {
  int _page = 1;
  bool _hasMore = true;

  @override
  FutureOr<List<Comment>> build(String postId) async {
    _page = 1;
    _hasMore = true;
    return _fetchComments();
  }

  Future<List<Comment>> _fetchComments() async {
    final repository = ref.read(commentRepositoryProvider);
    final result = await repository.getComments(
      postId: arg,
      page: _page,
    );

    return result.fold(
      (failure) => throw failure,
      (comments) {
        if (comments.length < 20) _hasMore = false;
        return comments;
      },
    );
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;

    _page++;
    final currentComments = state.valueOrNull ?? [];

    final newComments = await _fetchComments();
    state = AsyncData([...currentComments, ...newComments]);
  }

  Future<void> addComment(String content) async {
    final repository = ref.read(commentRepositoryProvider);
    final result = await repository.addComment(
      postId: arg,
      content: content,
    );

    result.fold(
      (failure) => null,
      (comment) {
        final currentComments = state.valueOrNull ?? [];
        state = AsyncData([comment, ...currentComments]);
      },
    );
  }

  void likeComment(String commentId) {
    _updateCommentInState(commentId, (comment) => comment.copyWith(
      isLiked: true,
      likesCount: comment.likesCount + 1,
    ));

    ref.read(commentRepositoryProvider).likeComment(commentId);
  }

  void unlikeComment(String commentId) {
    _updateCommentInState(commentId, (comment) => comment.copyWith(
      isLiked: false,
      likesCount: comment.likesCount - 1,
    ));

    ref.read(commentRepositoryProvider).unlikeComment(commentId);
  }

  void deleteComment(String commentId) {
    final currentComments = state.valueOrNull ?? [];
    state = AsyncData(currentComments.where((c) => c.id != commentId).toList());

    ref.read(commentRepositoryProvider).deleteComment(commentId);
  }

  void _updateCommentInState(String commentId, Comment Function(Comment) update) {
    final currentComments = state.valueOrNull ?? [];
    state = AsyncData(
      currentComments.map((comment) {
        if (comment.id == commentId) {
          return update(comment);
        }
        return comment;
      }).toList(),
    );
  }

  bool get hasMore => _hasMore;
}
```

### Comments Screen

```dart
// lib/features/feed/presentation/screens/comments_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

class CommentsScreen extends ConsumerStatefulWidget {
  final String postId;

  const CommentsScreen({
    super.key,
    required this.postId,
  });

  @override
  ConsumerState<CommentsScreen> createState() => _CommentsScreenState();
}

class _CommentsScreenState extends ConsumerState<CommentsScreen> {
  final _commentController = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();
  String? _replyToCommentId;
  String? _replyToUsername;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _commentController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 100) {
      ref.read(commentsNotifierProvider(widget.postId).notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final commentsAsync = ref.watch(commentsNotifierProvider(widget.postId));
    final currentUser = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Comments'),
      ),
      body: Column(
        children: [
          // Comments list
          Expanded(
            child: commentsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Failed to load comments'),
                    ElevatedButton(
                      onPressed: () => ref.invalidate(
                        commentsNotifierProvider(widget.postId),
                      ),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (comments) {
                if (comments.isEmpty) {
                  return const Center(
                    child: Text('No comments yet. Be the first!'),
                  );
                }

                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: comments.length,
                  itemBuilder: (context, index) {
                    return _CommentItem(
                      comment: comments[index],
                      onLike: () {
                        final notifier = ref.read(
                          commentsNotifierProvider(widget.postId).notifier,
                        );
                        if (comments[index].isLiked) {
                          notifier.unlikeComment(comments[index].id);
                        } else {
                          notifier.likeComment(comments[index].id);
                        }
                      },
                      onReply: () {
                        setState(() {
                          _replyToCommentId = comments[index].id;
                          _replyToUsername = comments[index].author.username;
                        });
                        _focusNode.requestFocus();
                      },
                      onDelete: currentUser?.id == comments[index].author.id
                          ? () => _showDeleteDialog(comments[index].id)
                          : null,
                    );
                  },
                );
              },
            ),
          ),

          // Reply indicator
          if (_replyToUsername != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppColors.surface,
              child: Row(
                children: [
                  Text(
                    'Replying to @$_replyToUsername',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () {
                      setState(() {
                        _replyToCommentId = null;
                        _replyToUsername = null;
                      });
                    },
                  ),
                ],
              ),
            ),

          // Comment input
          SafeArea(
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                border: Border(
                  top: BorderSide(color: AppColors.border),
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundImage: currentUser?.avatarUrl != null
                        ? CachedNetworkImageProvider(currentUser!.avatarUrl!)
                        : null,
                    child: currentUser?.avatarUrl == null
                        ? Text(currentUser?.username[0].toUpperCase() ?? 'U')
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      focusNode: _focusNode,
                      decoration: InputDecoration(
                        hintText: 'Add a comment...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                        filled: true,
                        fillColor: AppColors.surface,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                      ),
                      maxLines: null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: _submitComment,
                    child: const Text('Post'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _submitComment() {
    final content = _commentController.text.trim();
    if (content.isEmpty) return;

    ref.read(commentsNotifierProvider(widget.postId).notifier).addComment(content);

    _commentController.clear();
    setState(() {
      _replyToCommentId = null;
      _replyToUsername = null;
    });
    FocusScope.of(context).unfocus();
  }

  void _showDeleteDialog(String commentId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete comment?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(commentsNotifierProvider(widget.postId).notifier)
                  .deleteComment(commentId);
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}

class _CommentItem extends StatelessWidget {
  final Comment comment;
  final VoidCallback onLike;
  final VoidCallback onReply;
  final VoidCallback? onDelete;

  const _CommentItem({
    required this.comment,
    required this.onLike,
    required this.onReply,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () => context.push('/profile/${comment.author.id}'),
            child: CircleAvatar(
              radius: 18,
              backgroundImage: comment.author.avatarUrl != null
                  ? CachedNetworkImageProvider(comment.author.avatarUrl!)
                  : null,
              child: comment.author.avatarUrl == null
                  ? Text(comment.author.username[0].toUpperCase())
                  : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: Theme.of(context).textTheme.bodyMedium,
                    children: [
                      TextSpan(
                        text: comment.author.username,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const TextSpan(text: ' '),
                      TextSpan(text: comment.content),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      _formatTimeAgo(comment.createdAt),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (comment.likesCount > 0) ...[
                      const SizedBox(width: 12),
                      Text(
                        '${comment.likesCount} likes',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: onReply,
                      child: Text(
                        'Reply',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            children: [
              IconButton(
                icon: Icon(
                  comment.isLiked ? Icons.favorite : Icons.favorite_border,
                  size: 16,
                  color: comment.isLiked ? Colors.red : AppColors.textSecondary,
                ),
                onPressed: onLike,
              ),
              if (onDelete != null)
                IconButton(
                  icon: Icon(
                    Icons.delete_outline,
                    size: 16,
                    color: AppColors.textSecondary,
                  ),
                  onPressed: onDelete,
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatTimeAgo(DateTime dateTime) {
    final difference = DateTime.now().difference(dateTime);
    if (difference.inDays > 0) {
      return '${difference.inDays}d';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m';
    } else {
      return 'Now';
    }
  }
}
```

---

## 3.6 Create Post

### Create Post Screen

```dart
// lib/features/feed/presentation/screens/create_post_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

class CreatePostScreen extends ConsumerStatefulWidget {
  const CreatePostScreen({super.key});

  @override
  ConsumerState<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends ConsumerState<CreatePostScreen> {
  final _captionController = TextEditingController();
  final List<File> _selectedMedia = [];
  bool _isVideo = false;
  bool _isPosting = false;
  Location? _selectedLocation;

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Post'),
        actions: [
          TextButton(
            onPressed: _selectedMedia.isEmpty || _isPosting
                ? null
                : _createPost,
            child: _isPosting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Share'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // User info + Caption
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundImage: currentUser?.avatarUrl != null
                        ? CachedNetworkImageProvider(currentUser!.avatarUrl!)
                        : null,
                    child: currentUser?.avatarUrl == null
                        ? Text(currentUser?.username[0].toUpperCase() ?? 'U')
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _captionController,
                      decoration: const InputDecoration(
                        hintText: 'Write a caption...',
                        border: InputBorder.none,
                      ),
                      maxLines: 5,
                      minLines: 1,
                    ),
                  ),
                ],
              ),
            ),

            // Selected media preview
            if (_selectedMedia.isNotEmpty)
              SizedBox(
                height: 200,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _selectedMedia.length + 1,
                  itemBuilder: (context, index) {
                    if (index == _selectedMedia.length) {
                      if (_selectedMedia.length < 10) {
                        return _AddMediaButton(
                          onTap: () => _pickMedia(fromCamera: false),
                        );
                      }
                      return const SizedBox();
                    }

                    return _MediaPreview(
                      file: _selectedMedia[index],
                      isVideo: _isVideo,
                      onRemove: () {
                        setState(() {
                          _selectedMedia.removeAt(index);
                          if (_selectedMedia.isEmpty) {
                            _isVideo = false;
                          }
                        });
                      },
                    );
                  },
                ),
              ),

            // Media picker buttons
            if (_selectedMedia.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: _MediaPickerButton(
                        icon: Icons.photo_library,
                        label: 'Gallery',
                        onTap: () => _pickMedia(fromCamera: false),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MediaPickerButton(
                        icon: Icons.camera_alt,
                        label: 'Camera',
                        onTap: () => _pickMedia(fromCamera: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MediaPickerButton(
                        icon: Icons.videocam,
                        label: 'Video',
                        onTap: () => _pickVideo(),
                      ),
                    ),
                  ],
                ),
              ),

            const Divider(),

            // Location
            ListTile(
              leading: const Icon(Icons.location_on_outlined),
              title: Text(_selectedLocation?.name ?? 'Add location'),
              trailing: _selectedLocation != null
                  ? IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        setState(() => _selectedLocation = null);
                      },
                    )
                  : const Icon(Icons.chevron_right),
              onTap: () async {
                final location = await context.push<Location>('/select-location');
                if (location != null) {
                  setState(() => _selectedLocation = location);
                }
              },
            ),

            // Tag people
            ListTile(
              leading: const Icon(Icons.person_add_outlined),
              title: const Text('Tag people'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                // TODO: Tag people
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickMedia({required bool fromCamera}) async {
    final picker = ImagePicker();

    if (fromCamera) {
      final photo = await picker.pickImage(source: ImageSource.camera);
      if (photo != null) {
        setState(() {
          _selectedMedia.add(File(photo.path));
        });
      }
    } else {
      final photos = await picker.pickMultiImage(limit: 10 - _selectedMedia.length);
      if (photos.isNotEmpty) {
        setState(() {
          _selectedMedia.addAll(photos.map((p) => File(p.path)));
        });
      }
    }
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final video = await picker.pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(minutes: 1),
    );

    if (video != null) {
      setState(() {
        _selectedMedia.clear();
        _selectedMedia.add(File(video.path));
        _isVideo = true;
      });
    }
  }

  Future<void> _createPost() async {
    setState(() => _isPosting = true);

    final request = CreatePostRequest(
      content: _captionController.text.trim(),
      files: _selectedMedia,
      isVideo: _isVideo,
      location: _selectedLocation,
    );

    final repository = ref.read(feedRepositoryProvider);
    final result = await repository.createPost(request);

    result.fold(
      (failure) {
        setState(() => _isPosting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message)),
        );
      },
      (post) {
        // Refresh feed and go back
        ref.invalidate(feedNotifierProvider);
        context.pop();
      },
    );
  }
}

class _MediaPickerButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _MediaPickerButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, size: 32),
            const SizedBox(height: 8),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _MediaPreview extends StatelessWidget {
  final File file;
  final bool isVideo;
  final VoidCallback onRemove;

  const _MediaPreview({
    required this.file,
    required this.isVideo,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: isVideo
                ? _VideoThumbnail(file: file)
                : Image.file(
                    file,
                    width: 150,
                    height: 200,
                    fit: BoxFit.cover,
                  ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.close,
                  color: Colors.white,
                  size: 16,
                ),
              ),
            ),
          ),
          if (isVideo)
            const Positioned(
              bottom: 8,
              left: 8,
              child: Icon(
                Icons.play_circle_fill,
                color: Colors.white,
                size: 32,
              ),
            ),
        ],
      ),
    );
  }
}

class _AddMediaButton extends StatelessWidget {
  final VoidCallback onTap;

  const _AddMediaButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 100,
        height: 200,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add, size: 32),
            SizedBox(height: 4),
            Text('Add'),
          ],
        ),
      ),
    );
  }
}
```

---

## Testing Checklist

### Feed Tests
- [ ] Feed loads and displays posts
- [ ] Pull-to-refresh works
- [ ] Infinite scroll loads more posts
- [ ] Like/unlike with optimistic update
- [ ] Save/unsave post
- [ ] Double-tap to like with animation

### Post Tests
- [ ] Post card displays all info correctly
- [ ] Multi-image carousel works
- [ ] Video player works
- [ ] Post options menu works
- [ ] Share and copy link work

### Stories Tests
- [ ] Stories bar shows all stories
- [ ] Add story button works
- [ ] Story viewer plays through all items
- [ ] Seen/unseen ring indicator works
- [ ] Story auto-advances after timer
- [ ] Reply to story works

### Comments Tests
- [ ] Comments load and paginate
- [ ] Add comment works
- [ ] Like/unlike comment works
- [ ] Reply to comment works
- [ ] Delete own comment works

### Create Post Tests
- [ ] Pick single/multiple images
- [ ] Pick video
- [ ] Add caption
- [ ] Add location
- [ ] Upload progress works
- [ ] Post creation succeeds

---

## Claude Code Prompts

### Prompt: Feed Screen
```
Create the feed screen for Flutter with:
1. AppBar with logo and action buttons (create, activity, messages)
2. Stories bar at top with add story button
3. SliverList of PostCards with infinite scroll
4. Pull-to-refresh for both stories and feed
5. Empty state when no posts
```

### Prompt: Post Card
```
Create PostCard widget with:
1. Header with avatar, username, verified badge, location, menu
2. Media section with carousel for multiple images
3. Double-tap to like with heart animation
4. Action bar (like, comment, share, save)
5. Likes count, caption, comments link, timestamp
6. Optimistic update on like/save
```

### Prompt: Story Viewer
```
Create story viewer with:
1. PageView for multiple users' stories
2. Progress bar at top showing items
3. Tap left/right to navigate items
4. Auto-advance after timer
5. Pause on long press
6. Reply input at bottom
7. Mark as seen when viewed
```

### Prompt: Create Post
```
Create post creation flow with:
1. Media picker (gallery, camera, video)
2. Multi-image selection up to 10
3. Caption input with mentions
4. Location picker
5. Tag people
6. Upload progress indicator
7. Create post API call
```
