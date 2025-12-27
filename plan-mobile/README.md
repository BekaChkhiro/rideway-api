# Bike Area Mobile - Flutter Development Plan

## Project Overview

This document outlines the complete mobile application development plan for Bike Area. The app will be built with Flutter for both iOS and Android platforms, providing a native-like experience with excellent performance. The mobile app is the primary user interface and will share the API backend with the web application.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Flutter 3.x | Cross-platform UI |
| Language | Dart 3.x | Type-safe development |
| State Management | Riverpod 2.0 | Reactive state management |
| Navigation | go_router | Declarative routing |
| HTTP Client | Dio | API communication |
| Local Storage | Hive + SharedPreferences | Offline data & settings |
| Push Notifications | Firebase Cloud Messaging | Push notifications |
| Real-time | socket_io_client | Chat & live updates |
| Image Handling | cached_network_image | Image caching |
| Camera | camera + image_picker | Media capture |
| Maps | google_maps_flutter | Location features |
| Animations | flutter_animate | Smooth animations |
| Forms | flutter_form_builder | Form handling |

## Architecture

### Clean Architecture + Feature-First

```
lib/
├── main.dart
├── app/
│   ├── app.dart                    # MaterialApp configuration
│   ├── router.dart                 # go_router setup
│   └── theme/
│       ├── app_theme.dart          # Theme configuration
│       ├── colors.dart             # Color palette
│       └── typography.dart         # Text styles
├── core/
│   ├── constants/
│   │   ├── api_constants.dart      # API endpoints
│   │   └── app_constants.dart      # App-wide constants
│   ├── error/
│   │   ├── exceptions.dart         # Custom exceptions
│   │   └── failures.dart           # Failure classes
│   ├── network/
│   │   ├── api_client.dart         # Dio configuration
│   │   ├── interceptors/           # Auth, logging interceptors
│   │   └── network_info.dart       # Connectivity check
│   ├── storage/
│   │   ├── secure_storage.dart     # Encrypted storage
│   │   └── local_storage.dart      # Hive boxes
│   └── utils/
│       ├── validators.dart         # Input validation
│       ├── formatters.dart         # Date, number formatters
│       └── helpers.dart            # Utility functions
├── features/
│   ├── auth/
│   │   ├── data/
│   │   │   ├── datasources/        # Remote & local data sources
│   │   │   ├── models/             # Data models (JSON)
│   │   │   └── repositories/       # Repository implementations
│   │   ├── domain/
│   │   │   ├── entities/           # Business entities
│   │   │   ├── repositories/       # Abstract repositories
│   │   │   └── usecases/           # Business logic
│   │   └── presentation/
│   │       ├── providers/          # Riverpod providers
│   │       ├── screens/            # Screen widgets
│   │       └── widgets/            # Feature-specific widgets
│   ├── feed/
│   ├── profile/
│   ├── marketplace/
│   ├── parts/
│   ├── forum/
│   ├── services/
│   ├── chat/
│   ├── notifications/
│   └── settings/
├── shared/
│   ├── widgets/
│   │   ├── buttons/
│   │   ├── cards/
│   │   ├── inputs/
│   │   ├── loaders/
│   │   └── dialogs/
│   ├── providers/                  # Shared providers
│   └── extensions/                 # Dart extensions
└── l10n/                           # Localization
    ├── app_ka.arb                  # Georgian
    └── app_en.arb                  # English
```

## Development Phases

### [Phase 1: Foundation](./phase-1-foundation.md)
Setting up Flutter project, architecture, theming, navigation, API client, and core infrastructure.

**Scope:** Project setup, Architecture, Theme, Navigation, API client, Storage

---

### [Phase 2: Authentication & Profile](./phase-2-core.md)
Implementing authentication flows and user profile management.

**Scope:** Login, Register, OTP, Profile, Settings, Media upload

---

### [Phase 3: Social Features](./phase-3-social.md)
Building the social feed, posts, stories, comments, and interactions.

**Scope:** Feed, Posts, Stories, Comments, Likes, Follow system

---

### [Phase 4: Marketplace & Forum](./phase-4-marketplace.md)
Implementing marketplace listings, parts catalog, forum, and services.

**Scope:** Listings, Parts, Forum threads, Services, Reviews, Maps

---

### [Phase 5: Real-time Features](./phase-5-realtime.md)
Adding real-time chat, push notifications, and live updates.

**Scope:** Chat, Push notifications, Online status, Typing indicators

---

### [Phase 6: Production Ready](./phase-6-production.md)
Polish, optimization, testing, and app store deployment.

**Scope:** Performance, Testing, CI/CD, App Store, Play Store

---

## Key Features

### User Experience
- Smooth 60 FPS animations
- Offline-first with sync
- Pull-to-refresh everywhere
- Infinite scroll lists
- Image lazy loading with placeholders
- Skeleton loading states
- Haptic feedback
- Dark mode support

### Core Features
- **Feed** - Personalized post feed
- **Stories** - 24-hour ephemeral content
- **Marketplace** - Motorcycle listings
- **Parts** - Parts with compatibility search
- **Forum** - Community discussions
- **Services** - Service provider directory
- **Chat** - Real-time messaging
- **Notifications** - Push & in-app

### Native Integrations
- Camera for photos/videos
- Photo gallery access
- Push notifications (FCM)
- Location services
- Share extension
- Deep linking
- Biometric auth (Face ID, Fingerprint)

## State Management (Riverpod)

```dart
// Example provider structure
// features/feed/presentation/providers/feed_provider.dart

@riverpod
class FeedNotifier extends _$FeedNotifier {
  @override
  FutureOr<List<Post>> build() async {
    return await ref.read(feedRepositoryProvider).getFeed(page: 1);
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(feedRepositoryProvider).getFeed(page: 1),
    );
  }

  Future<void> loadMore() async {
    final currentPosts = state.valueOrNull ?? [];
    final nextPage = (currentPosts.length ~/ 10) + 1;

    final newPosts = await ref.read(feedRepositoryProvider).getFeed(page: nextPage);
    state = AsyncData([...currentPosts, ...newPosts]);
  }

  Future<void> likePost(String postId) async {
    // Optimistic update
    state = AsyncData(
      state.value!.map((post) {
        if (post.id == postId) {
          return post.copyWith(
            isLiked: !post.isLiked,
            likesCount: post.isLiked ? post.likesCount - 1 : post.likesCount + 1,
          );
        }
        return post;
      }).toList(),
    );

    // API call
    await ref.read(feedRepositoryProvider).likePost(postId);
  }
}
```

## Design System

### Colors
```dart
// Racing-inspired color palette
class AppColors {
  // Primary - Racing Red
  static const primary = Color(0xFFE63946);
  static const primaryLight = Color(0xFFFF6B6B);
  static const primaryDark = Color(0xFFB71C1C);

  // Secondary - Deep Blue
  static const secondary = Color(0xFF1D3557);
  static const secondaryLight = Color(0xFF457B9D);

  // Accent - Orange
  static const accent = Color(0xFFF4A261);

  // Neutral
  static const background = Color(0xFFFAFAFA);
  static const surface = Color(0xFFFFFFFF);
  static const textPrimary = Color(0xFF1A1A1A);
  static const textSecondary = Color(0xFF6B7280);
  static const border = Color(0xFFE5E7EB);

  // Dark Mode
  static const backgroundDark = Color(0xFF121212);
  static const surfaceDark = Color(0xFF1E1E1E);
  static const textPrimaryDark = Color(0xFFF5F5F5);
}
```

### Typography
```dart
class AppTypography {
  static const fontFamily = 'Inter';
  static const displayFontFamily = 'Montserrat';

  static const displayLarge = TextStyle(
    fontFamily: displayFontFamily,
    fontSize: 32,
    fontWeight: FontWeight.bold,
  );

  static const headlineLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w600,
  );

  static const bodyLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    fontWeight: FontWeight.normal,
  );

  static const labelMedium = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w500,
  );
}
```

## API Integration

```dart
// core/network/api_client.dart
class ApiClient {
  final Dio _dio;
  final AuthStorage _authStorage;

  ApiClient(this._dio, this._authStorage) {
    _dio.options = BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    );

    _dio.interceptors.addAll([
      AuthInterceptor(_authStorage),
      LoggingInterceptor(),
      RetryInterceptor(),
    ]);
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final response = await _dio.get(path, queryParameters: queryParameters);
    return response.data;
  }

  Future<T> post<T>(String path, {dynamic data}) async {
    final response = await _dio.post(path, data: data);
    return response.data;
  }

  Future<T> upload<T>(String path, FormData formData) async {
    final response = await _dio.post(
      path,
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    return response.data;
  }
}
```

## Environment Configuration

```dart
// lib/core/config/env_config.dart
enum Environment { development, staging, production }

class EnvConfig {
  static late Environment environment;

  static String get apiUrl {
    switch (environment) {
      case Environment.development:
        return 'http://localhost:3000/api/v1';
      case Environment.staging:
        return 'https://staging-api.bikearea.ge/api/v1';
      case Environment.production:
        return 'https://api.bikearea.ge/api/v1';
    }
  }

  static String get wsUrl {
    switch (environment) {
      case Environment.development:
        return 'ws://localhost:3000';
      case Environment.staging:
        return 'wss://staging-api.bikearea.ge';
      case Environment.production:
        return 'wss://api.bikearea.ge';
    }
  }
}
```

## Quick Start Commands

```bash
# Install dependencies
flutter pub get

# Run code generation (Riverpod, Freezed, etc.)
flutter pub run build_runner build --delete-conflicting-outputs

# Run on device/emulator
flutter run

# Run with specific flavor
flutter run --flavor development -t lib/main_dev.dart
flutter run --flavor production -t lib/main_prod.dart

# Build APK
flutter build apk --release

# Build iOS
flutter build ios --release

# Run tests
flutter test

# Run integration tests
flutter test integration_test/

# Analyze code
flutter analyze

# Format code
dart format lib/
```

## Progress Tracking

- [ ] Phase 1: Foundation
- [ ] Phase 2: Authentication & Profile
- [ ] Phase 3: Social Features
- [ ] Phase 4: Marketplace & Forum
- [ ] Phase 5: Real-time Features
- [ ] Phase 6: Production Ready

---

## Resources

- [Flutter Documentation](https://docs.flutter.dev/)
- [Riverpod Documentation](https://riverpod.dev/)
- [go_router Documentation](https://pub.dev/packages/go_router)
- [Dio Documentation](https://pub.dev/packages/dio)
- [Firebase Flutter](https://firebase.flutter.dev/)
- [Flutter Best Practices](https://docs.flutter.dev/perf/best-practices)
