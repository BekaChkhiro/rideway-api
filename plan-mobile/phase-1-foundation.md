# Phase 1: Foundation

## Overview

This phase establishes the Flutter project foundation. We'll set up the project structure following Clean Architecture, configure theming, implement navigation with go_router, create the API client with Dio, set up state management with Riverpod, and build core shared widgets.

## Goals

- Initialize Flutter project with proper structure
- Configure Riverpod for state management
- Set up go_router for navigation
- Create API client with Dio
- Implement theming (light/dark mode)
- Build core reusable widgets
- Set up local storage with Hive

---

## Tasks

### 1.1 Project Initialization

- [ ] Create Flutter project
- [ ] Configure project structure (Clean Architecture)
- [ ] Set up code generation (build_runner)
- [ ] Configure analysis_options.yaml
- [ ] Set up Git hooks (pre-commit)
- [ ] Create environment configurations

### 1.2 Dependencies Setup

- [ ] Add core dependencies to pubspec.yaml
- [ ] Configure Riverpod
- [ ] Set up Freezed for data classes
- [ ] Configure json_serializable
- [ ] Add flutter_hooks

### 1.3 Theming & Design System

- [ ] Create color palette
- [ ] Define typography styles
- [ ] Configure ThemeData (light/dark)
- [ ] Create spacing constants
- [ ] Set up icon system
- [ ] Add custom fonts (Inter, Montserrat)

### 1.4 Navigation

- [ ] Configure go_router
- [ ] Define route paths
- [ ] Create navigation guards (auth)
- [ ] Set up deep linking
- [ ] Implement bottom navigation shell
- [ ] Add transition animations

### 1.5 API Client

- [ ] Create Dio instance
- [ ] Implement auth interceptor
- [ ] Add logging interceptor
- [ ] Create retry interceptor
- [ ] Build API response models
- [ ] Handle errors globally

### 1.6 Local Storage

- [ ] Configure Hive
- [ ] Create secure storage for tokens
- [ ] Set up user preferences storage
- [ ] Implement caching layer
- [ ] Create offline queue

### 1.7 Core Widgets

- [ ] Create button variants
- [ ] Build text input components
- [ ] Create loading indicators
- [ ] Build error/empty states
- [ ] Create image components
- [ ] Build card components

---

## Technical Details

### Project Structure

```
lib/
├── main.dart                       # Entry point
├── main_dev.dart                   # Development flavor
├── main_prod.dart                  # Production flavor
├── app/
│   ├── app.dart                    # App widget
│   ├── router.dart                 # Router configuration
│   └── theme/
│       ├── app_theme.dart
│       ├── colors.dart
│       ├── typography.dart
│       └── dimensions.dart
├── core/
│   ├── constants/
│   │   ├── api_constants.dart
│   │   ├── app_constants.dart
│   │   └── storage_keys.dart
│   ├── config/
│   │   └── env_config.dart
│   ├── error/
│   │   ├── exceptions.dart
│   │   └── failures.dart
│   ├── network/
│   │   ├── api_client.dart
│   │   ├── api_response.dart
│   │   └── interceptors/
│   │       ├── auth_interceptor.dart
│   │       ├── logging_interceptor.dart
│   │       └── retry_interceptor.dart
│   ├── storage/
│   │   ├── hive_storage.dart
│   │   ├── secure_storage.dart
│   │   └── preferences_storage.dart
│   └── utils/
│       ├── validators.dart
│       ├── formatters.dart
│       └── extensions.dart
├── features/
│   └── ... (created in later phases)
└── shared/
    ├── providers/
    │   ├── api_client_provider.dart
    │   └── storage_providers.dart
    ├── widgets/
    │   ├── buttons/
    │   │   ├── primary_button.dart
    │   │   ├── secondary_button.dart
    │   │   └── icon_button.dart
    │   ├── inputs/
    │   │   ├── text_input.dart
    │   │   ├── password_input.dart
    │   │   └── search_input.dart
    │   ├── loaders/
    │   │   ├── loading_indicator.dart
    │   │   ├── skeleton_loader.dart
    │   │   └── shimmer.dart
    │   ├── states/
    │   │   ├── empty_state.dart
    │   │   ├── error_state.dart
    │   │   └── loading_state.dart
    │   ├── images/
    │   │   ├── cached_image.dart
    │   │   └── avatar.dart
    │   └── cards/
    │       └── base_card.dart
    └── extensions/
        ├── context_extensions.dart
        ├── string_extensions.dart
        └── date_extensions.dart
```

### Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.4.9
  riverpod_annotation: ^2.3.3
  hooks_riverpod: ^2.4.9
  flutter_hooks: ^0.20.4

  # Navigation
  go_router: ^13.0.1

  # Network
  dio: ^5.4.0
  connectivity_plus: ^5.0.2

  # Storage
  hive_flutter: ^1.1.0
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.2

  # Data Classes
  freezed_annotation: ^2.4.1
  json_annotation: ^4.8.1

  # UI
  cached_network_image: ^3.3.1
  flutter_svg: ^2.0.9
  shimmer: ^3.0.0
  flutter_animate: ^4.3.0
  lottie: ^3.0.0

  # Forms
  flutter_form_builder: ^9.1.1
  form_builder_validators: ^9.1.0

  # Utils
  intl: ^0.18.1
  uuid: ^4.2.2
  logger: ^2.0.2+1
  equatable: ^2.0.5

  # Firebase (for push notifications)
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.10

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1

  # Code Generation
  build_runner: ^2.4.8
  riverpod_generator: ^2.3.9
  freezed: ^2.4.6
  json_serializable: ^6.7.1

  # Testing
  mocktail: ^1.0.1
  bloc_test: ^9.1.5
```

### App Configuration

```dart
// lib/app/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bike_area/app/router.dart';
import 'package:bike_area/app/theme/app_theme.dart';

class BikeAreaApp extends ConsumerWidget {
  const BikeAreaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'Bike Area',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaleFactor: 1.0),
          child: child!,
        );
      },
    );
  }
}

// Theme mode provider
@riverpod
class ThemeModeNotifier extends _$ThemeModeNotifier {
  @override
  ThemeMode build() {
    _loadThemeMode();
    return ThemeMode.system;
  }

  Future<void> _loadThemeMode() async {
    final prefs = await ref.read(preferencesProvider.future);
    final isDark = prefs.getBool('isDarkMode');
    if (isDark != null) {
      state = isDark ? ThemeMode.dark : ThemeMode.light;
    }
  }

  Future<void> toggle() async {
    final prefs = await ref.read(preferencesProvider.future);
    final isDark = state == ThemeMode.dark;
    await prefs.setBool('isDarkMode', !isDark);
    state = isDark ? ThemeMode.light : ThemeMode.dark;
  }
}
```

### Theme Configuration

```dart
// lib/app/theme/app_theme.dart
import 'package:flutter/material.dart';
import 'package:bike_area/app/theme/colors.dart';
import 'package:bike_area/app/theme/typography.dart';

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      tertiary: AppColors.accent,
      background: AppColors.background,
      surface: AppColors.surface,
      error: AppColors.error,
    ),
    scaffoldBackgroundColor: AppColors.background,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: AppTypography.headlineSmall.copyWith(
        color: AppColors.textPrimary,
      ),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: AppColors.surface,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: AppColors.textSecondary,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
    cardTheme: CardTheme(
      color: AppColors.surface,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.inputBackground,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.error),
      ),
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: AppTypography.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        textStyle: AppTypography.labelLarge,
      ),
    ),
    textTheme: TextTheme(
      displayLarge: AppTypography.displayLarge,
      displayMedium: AppTypography.displayMedium,
      headlineLarge: AppTypography.headlineLarge,
      headlineMedium: AppTypography.headlineMedium,
      headlineSmall: AppTypography.headlineSmall,
      titleLarge: AppTypography.titleLarge,
      titleMedium: AppTypography.titleMedium,
      bodyLarge: AppTypography.bodyLarge,
      bodyMedium: AppTypography.bodyMedium,
      labelLarge: AppTypography.labelLarge,
      labelMedium: AppTypography.labelMedium,
    ),
  );

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      primary: AppColors.primary,
      secondary: AppColors.secondaryLight,
      tertiary: AppColors.accent,
      background: AppColors.backgroundDark,
      surface: AppColors.surfaceDark,
      error: AppColors.error,
    ),
    scaffoldBackgroundColor: AppColors.backgroundDark,
    // ... dark theme overrides
  );
}
```

### Router Configuration

```dart
// lib/app/router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

part 'router.g.dart';

@riverpod
GoRouter router(RouterRef ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/feed',
    debugLogDiagnostics: true,
    refreshListenable: authState,
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isAuthenticated && !isAuthRoute) {
        return '/auth/login';
      }

      if (isAuthenticated && isAuthRoute) {
        return '/feed';
      }

      return null;
    },
    routes: [
      // Auth routes
      GoRoute(
        path: '/auth/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/auth/register',
        name: 'register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/auth/verify',
        name: 'verify',
        builder: (context, state) => const VerifyScreen(),
      ),
      GoRoute(
        path: '/auth/forgot-password',
        name: 'forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),

      // Main app shell with bottom navigation
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/feed',
            name: 'feed',
            builder: (context, state) => const FeedScreen(),
          ),
          GoRoute(
            path: '/explore',
            name: 'explore',
            builder: (context, state) => const ExploreScreen(),
          ),
          GoRoute(
            path: '/marketplace',
            name: 'marketplace',
            builder: (context, state) => const MarketplaceScreen(),
          ),
          GoRoute(
            path: '/messages',
            name: 'messages',
            builder: (context, state) => const MessagesScreen(),
          ),
          GoRoute(
            path: '/profile',
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),

      // Detail routes (outside shell)
      GoRoute(
        path: '/post/:id',
        name: 'post-detail',
        builder: (context, state) => PostDetailScreen(
          postId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/user/:username',
        name: 'user-profile',
        builder: (context, state) => UserProfileScreen(
          username: state.pathParameters['username']!,
        ),
      ),
      GoRoute(
        path: '/listing/:id',
        name: 'listing-detail',
        builder: (context, state) => ListingDetailScreen(
          listingId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/chat/:conversationId',
        name: 'chat',
        builder: (context, state) => ChatScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsScreen(),
        routes: [
          GoRoute(
            path: 'profile',
            name: 'edit-profile',
            builder: (context, state) => const EditProfileScreen(),
          ),
          GoRoute(
            path: 'notifications',
            name: 'notification-settings',
            builder: (context, state) => const NotificationSettingsScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => ErrorScreen(error: state.error),
  );
}

final _shellNavigatorKey = GlobalKey<NavigatorState>();
```

### API Client

```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bike_area/core/config/env_config.dart';
import 'package:bike_area/core/network/interceptors/auth_interceptor.dart';
import 'package:bike_area/core/network/interceptors/logging_interceptor.dart';
import 'package:bike_area/core/error/exceptions.dart';

@riverpod
ApiClient apiClient(ApiClientRef ref) {
  final dio = Dio(BaseOptions(
    baseUrl: EnvConfig.apiUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));

  final authStorage = ref.watch(authStorageProvider);

  dio.interceptors.addAll([
    AuthInterceptor(authStorage, ref),
    LoggingInterceptor(),
  ]);

  return ApiClient(dio);
}

class ApiClient {
  final Dio _dio;

  ApiClient(this._dio);

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _dio.get<T>(
        path,
        queryParameters: queryParameters,
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> patch<T>(
    String path, {
    dynamic data,
  }) async {
    try {
      final response = await _dio.patch<T>(path, data: data);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> delete<T>(String path) async {
    try {
      final response = await _dio.delete<T>(path);
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> upload<T>(
    String path,
    FormData formData, {
    void Function(int, int)? onSendProgress,
  }) async {
    try {
      final response = await _dio.post<T>(
        path,
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
        onSendProgress: onSendProgress,
      );
      return _handleResponse(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  T _handleResponse<T>(Response<T> response) {
    if (response.statusCode! >= 200 && response.statusCode! < 300) {
      return response.data as T;
    }
    throw ServerException(message: 'Unexpected error');
  }

  Exception _handleError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return NetworkException(message: 'Connection timeout');
      case DioExceptionType.connectionError:
        return NetworkException(message: 'No internet connection');
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final data = e.response?.data;
        final message = data?['error']?['message'] ?? 'Server error';

        if (statusCode == 401) {
          return UnauthorizedException(message: message);
        }
        if (statusCode == 403) {
          return ForbiddenException(message: message);
        }
        if (statusCode == 404) {
          return NotFoundException(message: message);
        }
        if (statusCode == 422) {
          return ValidationException(
            message: message,
            errors: data?['error']?['details'],
          );
        }
        return ServerException(message: message);
      default:
        return ServerException(message: 'Something went wrong');
    }
  }
}
```

### Auth Interceptor

```dart
// lib/core/network/interceptors/auth_interceptor.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:bike_area/core/storage/auth_storage.dart';

class AuthInterceptor extends Interceptor {
  final AuthStorage _authStorage;
  final Ref _ref;

  AuthInterceptor(this._authStorage, this._ref);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _authStorage.getAccessToken();

    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Try to refresh token
      final refreshToken = await _authStorage.getRefreshToken();

      if (refreshToken != null) {
        try {
          final newToken = await _refreshToken(refreshToken);
          await _authStorage.saveAccessToken(newToken);

          // Retry original request
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newToken';

          final response = await Dio().fetch(opts);
          return handler.resolve(response);
        } catch (_) {
          // Refresh failed, logout
          await _authStorage.clear();
          _ref.invalidate(authStateProvider);
        }
      }
    }

    handler.next(err);
  }

  Future<String> _refreshToken(String refreshToken) async {
    final response = await Dio().post(
      '${EnvConfig.apiUrl}/auth/refresh',
      data: {'refreshToken': refreshToken},
    );

    return response.data['data']['accessToken'];
  }
}
```

---

## Claude Code Prompts

### Prompt 1: Initialize Flutter Project

```
Create a new Flutter project for Bike Area mobile app:

1. Create Flutter project:
   flutter create --org ge.bikearea --project-name bike_area .

2. Configure pubspec.yaml with all dependencies listed in the plan

3. Set up project structure:
   - Create all directories as specified
   - Create placeholder files for each module

4. Configure analysis_options.yaml:
   - Enable strict-casts
   - Enable strict-raw-types
   - Add custom lint rules

5. Create environment configuration:
   - lib/core/config/env_config.dart
   - lib/main_dev.dart
   - lib/main_prod.dart

6. Set up code generation:
   - Create build.yaml for build_runner
   - Add generate script to pubspec.yaml

7. Configure assets:
   - Create assets/images/
   - Create assets/icons/
   - Create assets/fonts/
   - Add font files (Inter, Montserrat)

8. Run initial code generation:
   flutter pub get
   flutter pub run build_runner build
```

### Prompt 2: Create Theme System

```
Create the complete theming system:

1. Create lib/app/theme/colors.dart:
   - Define all color constants
   - Light and dark mode colors
   - Semantic colors (success, error, warning)

2. Create lib/app/theme/typography.dart:
   - Define all text styles
   - Use Inter and Montserrat fonts
   - Responsive font sizes

3. Create lib/app/theme/dimensions.dart:
   - Spacing constants (4, 8, 12, 16, 24, 32, 48)
   - Border radius values
   - Icon sizes
   - Common sizes

4. Create lib/app/theme/app_theme.dart:
   - Light ThemeData
   - Dark ThemeData
   - Component themes (AppBar, Button, Input, Card, etc.)

5. Create theme provider:
   - lib/shared/providers/theme_provider.dart
   - Persist theme preference
   - System theme detection

6. Create theme toggle widget:
   - lib/shared/widgets/theme_toggle.dart
   - Animated switch
```

### Prompt 3: Set Up Navigation

```
Configure go_router navigation:

1. Create lib/app/router.dart:
   - Configure GoRouter with Riverpod
   - Define all routes
   - Add auth guards (redirect logic)
   - Configure deep linking

2. Create route constants:
   lib/core/constants/routes.dart
   - All route paths as constants
   - Named route helpers

3. Create main shell with bottom navigation:
   lib/features/shell/presentation/screens/main_shell.dart
   - Bottom navigation bar
   - 5 tabs: Feed, Explore, Create, Messages, Profile
   - Handle navigation state

4. Create transitions:
   lib/app/router_transitions.dart
   - Slide transitions
   - Fade transitions
   - Custom page transitions

5. Create navigation service:
   lib/core/services/navigation_service.dart
   - Navigate with context
   - Pop with result
   - Push replacement
   - Clear stack

6. Set up deep linking:
   - Configure Android intent filters
   - Configure iOS URL schemes
   - Handle incoming links
```

### Prompt 4: Create API Client

```
Build the complete API client layer:

1. Create lib/core/network/api_client.dart:
   - Dio configuration
   - Base URL from environment
   - Timeout settings
   - Default headers

2. Create interceptors:
   lib/core/network/interceptors/
   - auth_interceptor.dart (token injection, refresh)
   - logging_interceptor.dart (request/response logging)
   - retry_interceptor.dart (retry on failure)

3. Create lib/core/network/api_response.dart:
   - Generic response wrapper
   - Parse success response
   - Parse error response
   - Pagination metadata

4. Create lib/core/error/exceptions.dart:
   - NetworkException
   - ServerException
   - UnauthorizedException
   - ValidationException
   - NotFoundException

5. Create lib/core/error/failures.dart:
   - Failure abstract class
   - NetworkFailure
   - ServerFailure
   - CacheFailure

6. Create API client provider:
   lib/shared/providers/api_client_provider.dart

7. Create connectivity check:
   lib/core/network/network_info.dart
   - Check internet connection
   - Listen to connectivity changes
```

### Prompt 5: Set Up Local Storage

```
Configure local storage with Hive and secure storage:

1. Create lib/core/storage/hive_storage.dart:
   - Initialize Hive
   - Register adapters
   - Create boxes for different data types

2. Create lib/core/storage/secure_storage.dart:
   - Flutter secure storage wrapper
   - Save/read/delete tokens
   - Encryption handling

3. Create lib/core/storage/auth_storage.dart:
   - Access token storage
   - Refresh token storage
   - Clear on logout

4. Create lib/core/storage/preferences_storage.dart:
   - User preferences
   - Theme mode
   - Language
   - Onboarding completion

5. Create lib/core/storage/cache_manager.dart:
   - Cache API responses
   - Cache expiration
   - Cache invalidation

6. Create storage providers:
   lib/shared/providers/storage_providers.dart
   - authStorageProvider
   - preferencesProvider
   - cacheProvider

7. Initialize storage in main.dart:
   - Call Hive.initFlutter()
   - Register adapters
   - Open required boxes
```

### Prompt 6: Create Core Widgets

```
Build reusable widget library:

1. Create button widgets:
   lib/shared/widgets/buttons/
   - primary_button.dart (filled, full width)
   - secondary_button.dart (outlined)
   - text_button.dart
   - icon_button.dart
   - loading_button.dart (with loading state)

2. Create input widgets:
   lib/shared/widgets/inputs/
   - text_input.dart (with label, error)
   - password_input.dart (with visibility toggle)
   - search_input.dart (with clear button)
   - otp_input.dart (6 digit code)

3. Create loading widgets:
   lib/shared/widgets/loaders/
   - loading_indicator.dart (circular)
   - skeleton_loader.dart (placeholder)
   - shimmer.dart (shimmer effect)
   - refresh_indicator.dart (pull to refresh)

4. Create state widgets:
   lib/shared/widgets/states/
   - empty_state.dart (icon, title, description, action)
   - error_state.dart (error message, retry button)
   - loading_state.dart (centered loader)
   - offline_state.dart (no connection)

5. Create image widgets:
   lib/shared/widgets/images/
   - cached_image.dart (with placeholder, error)
   - avatar.dart (circular, with online indicator)
   - image_gallery.dart (grid, lightbox)

6. Create card widgets:
   lib/shared/widgets/cards/
   - base_card.dart (rounded, shadow)
   - info_card.dart (icon, title, value)

7. Create dialog widgets:
   lib/shared/widgets/dialogs/
   - confirm_dialog.dart
   - loading_dialog.dart
   - bottom_sheet.dart
```

---

## Testing Checklist

### Unit Tests

- [ ] Theme colors match design
- [ ] Typography styles correct
- [ ] API client handles errors
- [ ] Auth interceptor adds token
- [ ] Storage saves/retrieves data
- [ ] Validators work correctly

### Widget Tests

- [ ] Buttons render correctly
- [ ] Inputs validate properly
- [ ] Loading states display
- [ ] Error states display
- [ ] Cards render correctly

### Integration Tests

- [ ] Router navigates correctly
- [ ] Auth guard redirects
- [ ] API calls work
- [ ] Storage persists

### Device Tests

- [ ] Light theme renders
- [ ] Dark theme renders
- [ ] Responsive on different sizes
- [ ] Landscape orientation

---

## Completion Criteria

Phase 1 is complete when:

1. **Project structure** is set up correctly
2. **Dependencies** are installed and working
3. **Theming** works with light/dark mode
4. **Navigation** works with all routes
5. **API client** connects to backend
6. **Storage** saves and retrieves data
7. **Core widgets** are reusable and styled
8. **Code generation** runs without errors

---

## Notes

- Use const constructors everywhere possible
- Follow Flutter naming conventions
- Add documentation comments to public APIs
- Keep widgets small and focused
- Use extensions for common operations
- Test on both iOS and Android regularly
