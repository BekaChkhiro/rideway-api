# Phase 6: Production Ready

## Overview

This final phase focuses on making the app production-ready: performance optimization, comprehensive testing, CI/CD setup, and App Store/Play Store deployment.

## Dependencies

```yaml
# pubspec.yaml - Phase 6 additions
dependencies:
  # Analytics
  firebase_analytics: ^10.8.6
  firebase_crashlytics: ^3.4.15
  firebase_performance: ^0.9.3+15

  # App updates
  package_info_plus: ^5.0.1
  in_app_update: ^4.2.2

  # App review
  in_app_review: ^2.0.8

dev_dependencies:
  # Testing
  flutter_test:
    sdk: flutter
  mockito: ^5.4.4
  mocktail: ^1.0.3
  bloc_test: ^9.1.5
  integration_test:
    sdk: flutter

  # Code quality
  very_good_analysis: ^5.1.0
  dart_code_metrics: ^5.7.6

  # Golden tests
  golden_toolkit: ^0.15.0
```

---

## 6.1 Performance Optimization

### Image Optimization

```dart
// lib/core/utils/image_cache_manager.dart
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

class AppImageCacheManager extends CacheManager {
  static const key = 'bikeAreaImageCache';

  static final AppImageCacheManager _instance = AppImageCacheManager._();

  factory AppImageCacheManager() => _instance;

  AppImageCacheManager._()
      : super(
          Config(
            key,
            stalePeriod: const Duration(days: 14),
            maxNrOfCacheObjects: 200,
            repo: JsonCacheInfoRepository(databaseName: key),
            fileService: HttpFileService(),
          ),
        );

  static void clearOldCache() {
    _instance.emptyCache();
  }
}

// Optimized network image widget
class OptimizedNetworkImage extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? placeholder;
  final Widget? errorWidget;

  const OptimizedNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.placeholder,
    this.errorWidget,
  });

  @override
  Widget build(BuildContext context) {
    // Use thumbnail URL for smaller displays
    final optimizedUrl = _getOptimizedUrl(imageUrl, width);

    return CachedNetworkImage(
      imageUrl: optimizedUrl,
      width: width,
      height: height,
      fit: fit,
      cacheManager: AppImageCacheManager(),
      memCacheWidth: width?.toInt(),
      memCacheHeight: height?.toInt(),
      placeholder: (context, url) =>
          placeholder ??
          Container(
            color: AppColors.surface,
            child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
      errorWidget: (context, url, error) =>
          errorWidget ??
          Container(
            color: AppColors.surface,
            child: const Icon(Icons.image_not_supported),
          ),
    );
  }

  String _getOptimizedUrl(String url, double? targetWidth) {
    // If using Cloudflare R2 with image transformations
    if (url.contains('r2.cloudflarestorage.com') && targetWidth != null) {
      // Add size parameter for CDN optimization
      final size = targetWidth <= 100
          ? 'thumbnail'
          : targetWidth <= 300
              ? 'small'
              : targetWidth <= 600
                  ? 'medium'
                  : 'large';
      return url.replaceFirst('/original/', '/$size/');
    }
    return url;
  }
}
```

### List Performance

```dart
// lib/shared/widgets/optimized_list_view.dart
import 'package:flutter/material.dart';

class OptimizedListView<T> extends StatefulWidget {
  final List<T> items;
  final Widget Function(BuildContext, T) itemBuilder;
  final Future<void> Function()? onRefresh;
  final Future<void> Function()? onLoadMore;
  final bool hasMore;
  final Widget? emptyWidget;
  final double? itemExtent;

  const OptimizedListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.onRefresh,
    this.onLoadMore,
    this.hasMore = false,
    this.emptyWidget,
    this.itemExtent,
  });

  @override
  State<OptimizedListView<T>> createState() => _OptimizedListViewState<T>();
}

class _OptimizedListViewState<T> extends State<OptimizedListView<T>> {
  final _scrollController = ScrollController();
  bool _isLoadingMore = false;

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
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !widget.hasMore || widget.onLoadMore == null) return;

    setState(() => _isLoadingMore = true);
    await widget.onLoadMore!();
    if (mounted) {
      setState(() => _isLoadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) {
      return widget.emptyWidget ?? const Center(child: Text('No items'));
    }

    Widget listView;

    if (widget.itemExtent != null) {
      // Use fixed extent for better performance
      listView = ListView.builder(
        controller: _scrollController,
        itemExtent: widget.itemExtent,
        itemCount: widget.items.length + (widget.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= widget.items.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }
          return widget.itemBuilder(context, widget.items[index]);
        },
      );
    } else {
      listView = ListView.builder(
        controller: _scrollController,
        itemCount: widget.items.length + (widget.hasMore ? 1 : 0),
        // Add automatic keep-alive for smoother scrolling
        addAutomaticKeepAlives: true,
        cacheExtent: 500,
        itemBuilder: (context, index) {
          if (index >= widget.items.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            );
          }
          return widget.itemBuilder(context, widget.items[index]);
        },
      );
    }

    if (widget.onRefresh != null) {
      return RefreshIndicator(
        onRefresh: widget.onRefresh!,
        child: listView,
      );
    }

    return listView;
  }
}
```

### Memory Management

```dart
// lib/core/utils/memory_manager.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class MemoryManager {
  static void clearImageCache() {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
  }

  static void clearAllCaches() {
    clearImageCache();
    AppImageCacheManager.clearOldCache();
  }

  static void listenForMemoryPressure() {
    SystemChannels.lifecycle.setMessageHandler((message) async {
      if (message == AppLifecycleState.paused.toString()) {
        // App is backgrounded, clear some caches
        clearImageCache();
      }
      return null;
    });
  }
}

// Use with WidgetsBindingObserver
mixin AppLifecycleManager on State<StatefulWidget>
    implements WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        // Refresh data when app resumes
        onAppResumed();
        break;
      case AppLifecycleState.paused:
        // Clean up when app is backgrounded
        onAppPaused();
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        break;
    }
  }

  void onAppResumed() {}
  void onAppPaused() {
    MemoryManager.clearImageCache();
  }

  @override
  void didHaveMemoryPressure() {
    MemoryManager.clearAllCaches();
  }

  @override
  void didChangeAccessibilityFeatures() {}

  @override
  void didChangeLocales(List<Locale>? locales) {}

  @override
  void didChangeMetrics() {}

  @override
  void didChangePlatformBrightness() {}

  @override
  void didChangeTextScaleFactor() {}

  @override
  Future<bool> didPopRoute() async => false;

  @override
  Future<bool> didPushRoute(String route) async => false;

  @override
  Future<bool> didPushRouteInformation(RouteInformation routeInformation) async => false;

  @override
  Future<ui.AppExitResponse> didRequestAppExit() async => ui.AppExitResponse.exit;
}
```

### Build Optimization

```yaml
# build.yaml - Enable optimizations
targets:
  $default:
    builders:
      freezed:
        options:
          copy_with: true
          equal: true
          to_string: true
      riverpod_generator:
        options:
          provider_name_prefix: ""
      json_serializable:
        options:
          explicit_to_json: true
          field_rename: snake
```

```dart
// analysis_options.yaml
include: package:very_good_analysis/analysis_options.yaml

analyzer:
  errors:
    invalid_annotation_target: warning
  plugins:
    - dart_code_metrics

dart_code_metrics:
  metrics:
    cyclomatic-complexity: 20
    number-of-parameters: 4
    maximum-nesting-level: 5
    source-lines-of-code: 50
  rules:
    - avoid-unused-parameters
    - avoid-unnecessary-setstate
    - avoid-wrapping-in-padding
    - prefer-const-border-radius
    - prefer-single-widget-per-file:
        ignore-private-widgets: true

linter:
  rules:
    public_member_api_docs: false
```

---

## 6.2 Testing

### Unit Tests

```dart
// test/features/auth/domain/usecases/verify_otp_test.dart
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late VerifyOtpUseCase useCase;
  late MockAuthRepository mockRepository;

  setUp(() {
    mockRepository = MockAuthRepository();
    useCase = VerifyOtpUseCase(mockRepository);
  });

  group('VerifyOtpUseCase', () {
    const testPhone = '+995555123456';
    const testCode = '123456';
    final testTokens = AuthTokens(
      accessToken: 'test_access',
      refreshToken: 'test_refresh',
      expiresAt: DateTime.now().add(const Duration(hours: 1)),
    );

    test('should return AuthTokens when verification is successful', () async {
      // Arrange
      when(() => mockRepository.verifyOtp(
        phone: testPhone,
        code: testCode,
      )).thenAnswer((_) async => Right(testTokens));

      // Act
      final result = await useCase(phone: testPhone, code: testCode);

      // Assert
      expect(result, Right(testTokens));
      verify(() => mockRepository.verifyOtp(
        phone: testPhone,
        code: testCode,
      )).called(1);
    });

    test('should return Failure when verification fails', () async {
      // Arrange
      const failure = ServerFailure('Invalid code');
      when(() => mockRepository.verifyOtp(
        phone: testPhone,
        code: testCode,
      )).thenAnswer((_) async => const Left(failure));

      // Act
      final result = await useCase(phone: testPhone, code: testCode);

      // Assert
      expect(result, const Left(failure));
    });
  });
}
```

### Widget Tests

```dart
// test/features/feed/presentation/widgets/post_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

void main() {
  group('PostCard', () {
    late Post testPost;

    setUp(() {
      testPost = Post(
        id: '1',
        author: User(
          id: '1',
          phone: '+995555123456',
          username: 'testuser',
          createdAt: DateTime.now(),
        ),
        content: 'Test post content',
        media: [],
        type: PostType.regular,
        createdAt: DateTime.now(),
      );
    });

    testWidgets('displays post content correctly', (tester) async {
      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(
          ProviderScope(
            child: MaterialApp(
              home: Scaffold(
                body: PostCard(
                  post: testPost,
                  onLike: () {},
                  onSave: () {},
                ),
              ),
            ),
          ),
        );

        expect(find.text('Test post content'), findsOneWidget);
        expect(find.text('testuser'), findsOneWidget);
      });
    });

    testWidgets('calls onLike when like button is tapped', (tester) async {
      bool likeCalled = false;

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(
          ProviderScope(
            child: MaterialApp(
              home: Scaffold(
                body: PostCard(
                  post: testPost,
                  onLike: () => likeCalled = true,
                  onSave: () {},
                ),
              ),
            ),
          ),
        );

        await tester.tap(find.byIcon(Icons.favorite_border));
        await tester.pump();

        expect(likeCalled, isTrue);
      });
    });

    testWidgets('shows liked state correctly', (tester) async {
      final likedPost = testPost.copyWith(isLiked: true, likesCount: 5);

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(
          ProviderScope(
            child: MaterialApp(
              home: Scaffold(
                body: PostCard(
                  post: likedPost,
                  onLike: () {},
                  onSave: () {},
                ),
              ),
            ),
          ),
        );

        expect(find.byIcon(Icons.favorite), findsOneWidget);
        expect(find.text('5 likes'), findsOneWidget);
      });
    });
  });
}
```

### Integration Tests

```dart
// integration_test/auth_flow_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication Flow', () {
    testWidgets('user can login with phone and OTP', (tester) async {
      // Launch app
      app.main();
      await tester.pumpAndSettle();

      // Should be on login screen
      expect(find.text('Welcome to Bike Area'), findsOneWidget);

      // Enter phone number
      await tester.enterText(
        find.byType(TextField),
        '555123456',
      );
      await tester.pumpAndSettle();

      // Tap continue
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      // Should navigate to OTP screen
      expect(find.text('Enter verification code'), findsOneWidget);

      // Enter OTP (using test code)
      await tester.enterText(
        find.byType(Pinput),
        '123456',
      );
      await tester.pumpAndSettle();

      // Should navigate to home
      await tester.pumpAndSettle(const Duration(seconds: 2));
      expect(find.byType(BottomNavigationBar), findsOneWidget);
    });

    testWidgets('user can logout', (tester) async {
      // Launch app (already logged in)
      app.main();
      await tester.pumpAndSettle();

      // Go to settings
      await tester.tap(find.byIcon(Icons.person));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.settings));
      await tester.pumpAndSettle();

      // Tap logout
      await tester.tap(find.text('Logout'));
      await tester.pumpAndSettle();

      // Confirm logout
      await tester.tap(find.text('Logout').last);
      await tester.pumpAndSettle();

      // Should be on login screen
      expect(find.text('Welcome to Bike Area'), findsOneWidget);
    });
  });
}
```

### Golden Tests

```dart
// test/golden/post_card_golden_test.dart
import 'package:golden_toolkit/golden_toolkit.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PostCard Golden Tests', () {
    testGoldens('PostCard - light theme', (tester) async {
      final builder = DeviceBuilder()
        ..overrideDevicesForAllScenarios(devices: [Device.phone])
        ..addScenario(
          widget: _buildPostCard(isLiked: false),
          name: 'post_card_default',
        )
        ..addScenario(
          widget: _buildPostCard(isLiked: true),
          name: 'post_card_liked',
        )
        ..addScenario(
          widget: _buildPostCard(hasMedia: true),
          name: 'post_card_with_media',
        );

      await tester.pumpDeviceBuilder(builder);
      await screenMatchesGolden(tester, 'post_card_light');
    });

    testGoldens('PostCard - dark theme', (tester) async {
      final builder = DeviceBuilder()
        ..overrideDevicesForAllScenarios(devices: [Device.phone])
        ..addScenario(
          widget: _buildPostCard(isDark: true),
          name: 'post_card_dark',
        );

      await tester.pumpDeviceBuilder(builder);
      await screenMatchesGolden(tester, 'post_card_dark');
    });
  });
}

Widget _buildPostCard({
  bool isLiked = false,
  bool hasMedia = false,
  bool isDark = false,
}) {
  return ProviderScope(
    child: MaterialApp(
      theme: isDark ? AppTheme.dark : AppTheme.light,
      home: Scaffold(
        body: PostCard(
          post: _createTestPost(isLiked: isLiked, hasMedia: hasMedia),
          onLike: () {},
          onSave: () {},
        ),
      ),
    ),
  );
}
```

---

## 6.3 Analytics & Crash Reporting

### Analytics Service

```dart
// lib/core/analytics/analytics_service.dart
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'analytics_service.g.dart';

class AnalyticsService {
  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  final FirebaseCrashlytics _crashlytics = FirebaseCrashlytics.instance;

  Future<void> initialize() async {
    // Enable crashlytics collection
    await _crashlytics.setCrashlyticsCollectionEnabled(true);

    // Catch Flutter errors
    FlutterError.onError = _crashlytics.recordFlutterFatalError;

    // Catch async errors
    PlatformDispatcher.instance.onError = (error, stack) {
      _crashlytics.recordError(error, stack, fatal: true);
      return true;
    };
  }

  // User tracking
  Future<void> setUserId(String userId) async {
    await _analytics.setUserId(id: userId);
    await _crashlytics.setUserIdentifier(userId);
  }

  Future<void> clearUserId() async {
    await _analytics.setUserId(id: null);
    await _crashlytics.setUserIdentifier('');
  }

  // Screen tracking
  Future<void> logScreenView(String screenName) async {
    await _analytics.logScreenView(screenName: screenName);
  }

  // Events
  Future<void> logLogin(String method) async {
    await _analytics.logLogin(loginMethod: method);
  }

  Future<void> logSignUp(String method) async {
    await _analytics.logSignUp(signUpMethod: method);
  }

  Future<void> logPostCreated(String postType) async {
    await _analytics.logEvent(
      name: 'post_created',
      parameters: {'type': postType},
    );
  }

  Future<void> logPostLiked(String postId) async {
    await _analytics.logEvent(
      name: 'post_liked',
      parameters: {'post_id': postId},
    );
  }

  Future<void> logListingViewed(String listingId, String brand, double price) async {
    await _analytics.logViewItem(
      currency: 'GEL',
      value: price,
      items: [
        AnalyticsEventItem(
          itemId: listingId,
          itemBrand: brand,
          price: price,
        ),
      ],
    );
  }

  Future<void> logListingCreated(String category, double price) async {
    await _analytics.logEvent(
      name: 'listing_created',
      parameters: {
        'category': category,
        'price': price,
      },
    );
  }

  Future<void> logMessageSent(String conversationType) async {
    await _analytics.logEvent(
      name: 'message_sent',
      parameters: {'type': conversationType},
    );
  }

  Future<void> logSearch(String searchTerm, String section) async {
    await _analytics.logSearch(
      searchTerm: searchTerm,
      parameters: {'section': section},
    );
  }

  // Errors
  Future<void> logError(dynamic error, StackTrace? stackTrace) async {
    await _crashlytics.recordError(error, stackTrace);
  }

  Future<void> logNonFatalError(String message, Map<String, dynamic>? info) async {
    await _crashlytics.log(message);
    if (info != null) {
      for (final entry in info.entries) {
        await _crashlytics.setCustomKey(entry.key, entry.value.toString());
      }
    }
  }
}

@riverpod
AnalyticsService analyticsService(AnalyticsServiceRef ref) {
  final service = AnalyticsService();
  service.initialize();
  return service;
}

// Analytics observer for go_router
class AnalyticsRouteObserver extends NavigatorObserver {
  final AnalyticsService _analytics;

  AnalyticsRouteObserver(this._analytics);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    _logScreenView(route);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);
    if (previousRoute != null) {
      _logScreenView(previousRoute);
    }
  }

  void _logScreenView(Route<dynamic> route) {
    final screenName = route.settings.name;
    if (screenName != null) {
      _analytics.logScreenView(screenName);
    }
  }
}
```

---

## 6.4 CI/CD with GitHub Actions

### Flutter CI Workflow

```yaml
# .github/workflows/flutter_ci.yml
name: Flutter CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  analyze-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'
          channel: 'stable'

      - name: Get dependencies
        run: flutter pub get

      - name: Generate code
        run: flutter pub run build_runner build --delete-conflicting-outputs

      - name: Analyze
        run: flutter analyze

      - name: Format check
        run: dart format --set-exit-if-changed lib test

      - name: Run tests
        run: flutter test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: coverage/lcov.info

  build-android:
    needs: analyze-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'

      - name: Get dependencies
        run: flutter pub get

      - name: Generate code
        run: flutter pub run build_runner build --delete-conflicting-outputs

      - name: Decode keystore
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
        run: |
          echo $KEYSTORE_BASE64 | base64 --decode > android/app/keystore.jks

      - name: Build APK
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          flutter build apk --release \
            --flavor production \
            -t lib/main_prod.dart

      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-release.apk
          path: build/app/outputs/flutter-apk/app-production-release.apk

  build-ios:
    needs: analyze-and-test
    runs-on: macos-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'

      - name: Get dependencies
        run: flutter pub get

      - name: Generate code
        run: flutter pub run build_runner build --delete-conflicting-outputs

      - name: Install CocoaPods
        run: |
          cd ios
          pod install

      - name: Build iOS
        run: |
          flutter build ios --release \
            --flavor production \
            -t lib/main_prod.dart \
            --no-codesign

      - name: Upload IPA
        uses: actions/upload-artifact@v3
        with:
          name: app-release.ipa
          path: build/ios/iphoneos/Runner.app
```

### Deploy to Stores

```yaml
# .github/workflows/deploy.yml
name: Deploy to Stores

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy-android:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Get dependencies
        run: flutter pub get

      - name: Generate code
        run: flutter pub run build_runner build --delete-conflicting-outputs

      - name: Decode keystore
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
        run: |
          echo $KEYSTORE_BASE64 | base64 --decode > android/app/keystore.jks

      - name: Build AAB
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          flutter build appbundle --release \
            --flavor production \
            -t lib/main_prod.dart

      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT }}
          packageName: ge.bikearea.app
          releaseFiles: build/app/outputs/bundle/productionRelease/app-production-release.aab
          track: internal
          status: draft

  deploy-ios:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'

      - name: Get dependencies
        run: flutter pub get

      - name: Generate code
        run: flutter pub run build_runner build --delete-conflicting-outputs

      - name: Install CocoaPods
        run: |
          cd ios
          pod install

      - name: Setup certificates
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.IOS_CERTIFICATE_BASE64 }}
          p12-password: ${{ secrets.IOS_CERTIFICATE_PASSWORD }}

      - name: Setup provisioning profile
        uses: apple-actions/download-provisioning-profiles@v1
        with:
          bundle-id: ge.bikearea.app
          issuer-id: ${{ secrets.APPSTORE_ISSUER_ID }}
          api-key-id: ${{ secrets.APPSTORE_API_KEY_ID }}
          api-private-key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}

      - name: Build iOS
        run: |
          flutter build ipa --release \
            --flavor production \
            -t lib/main_prod.dart \
            --export-options-plist=ios/ExportOptions.plist

      - name: Upload to TestFlight
        uses: apple-actions/upload-testflight-build@v1
        with:
          app-path: build/ios/ipa/bike_area.ipa
          issuer-id: ${{ secrets.APPSTORE_ISSUER_ID }}
          api-key-id: ${{ secrets.APPSTORE_API_KEY_ID }}
          api-private-key: ${{ secrets.APPSTORE_API_PRIVATE_KEY }}
```

---

## 6.5 App Store Configuration

### Android Configuration

```groovy
// android/app/build.gradle
android {
    compileSdkVersion 34

    defaultConfig {
        applicationId "ge.bikearea.app"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
    }

    signingConfigs {
        release {
            storeFile file("keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    flavorDimensions "environment"
    productFlavors {
        development {
            dimension "environment"
            applicationIdSuffix ".dev"
            resValue "string", "app_name", "Bike Area Dev"
        }
        staging {
            dimension "environment"
            applicationIdSuffix ".staging"
            resValue "string", "app_name", "Bike Area Staging"
        }
        production {
            dimension "environment"
            resValue "string", "app_name", "Bike Area"
        }
    }
}
```

### iOS Configuration

```ruby
# ios/Podfile
platform :ios, '14.0'

# CocoaPods analytics sends network stats synchronously affecting flutter build latency.
ENV['COCOAPODS_DISABLE_STATS'] = 'true'

project 'Runner', {
  'Debug' => :debug,
  'Profile' => :release,
  'Release' => :release,
}

target 'Runner' do
  use_frameworks!
  use_modular_headers!

  flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    flutter_additional_ios_build_settings(target)

    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
    end
  end
end
```

### App Icons & Splash

```yaml
# pubspec.yaml
flutter_icons:
  android: true
  ios: true
  image_path: "assets/icon/icon.png"
  adaptive_icon_background: "#E63946"
  adaptive_icon_foreground: "assets/icon/icon_foreground.png"

flutter_native_splash:
  color: "#E63946"
  image: assets/splash/logo.png
  android_12:
    color: "#E63946"
    icon_background_color: "#E63946"
    image: assets/splash/logo.png
```

---

## 6.6 Release Checklist

### Pre-Release

- [ ] All tests passing
- [ ] No analyzer warnings
- [ ] Performance profiling done
- [ ] Memory leaks checked
- [ ] All strings localized
- [ ] App icons and splash screen set
- [ ] Privacy policy URL ready
- [ ] Terms of service URL ready
- [ ] Support email configured
- [ ] Firebase project configured
- [ ] API endpoints pointing to production

### Android Release

- [ ] Release signing key created and backed up
- [ ] Version name and code updated
- [ ] ProGuard rules configured
- [ ] AAB built and tested
- [ ] Play Store listing prepared:
  - [ ] App title and description
  - [ ] Screenshots (phone, tablet)
  - [ ] Feature graphic
  - [ ] App category
  - [ ] Content rating questionnaire
  - [ ] Privacy policy
  - [ ] Contact details

### iOS Release

- [ ] App Store Connect app created
- [ ] Provisioning profiles created
- [ ] Bundle ID registered
- [ ] Push notification entitlement
- [ ] IPA built and tested
- [ ] App Store listing prepared:
  - [ ] App name and subtitle
  - [ ] Description and keywords
  - [ ] Screenshots (all device sizes)
  - [ ] App category
  - [ ] Age rating
  - [ ] Privacy policy URL
  - [ ] Support URL

### Post-Release

- [ ] Monitor crash reports in Crashlytics
- [ ] Monitor analytics in Firebase
- [ ] Respond to user reviews
- [ ] Plan for next update
- [ ] Document any hotfix procedures

---

## Testing Checklist Summary

### Unit Tests
- [ ] All use cases tested
- [ ] All repositories tested
- [ ] Edge cases covered
- [ ] Error handling tested

### Widget Tests
- [ ] All screens tested
- [ ] All widgets tested
- [ ] User interactions tested
- [ ] State changes tested

### Integration Tests
- [ ] Auth flow tested
- [ ] Main user journeys tested
- [ ] Navigation tested
- [ ] Deep links tested

### Performance Tests
- [ ] App startup time < 3s
- [ ] Screen transitions < 300ms
- [ ] List scrolling 60fps
- [ ] Memory usage stable

---

## Claude Code Prompts

### Prompt: CI/CD Setup
```
Create GitHub Actions workflow for Flutter with:
1. Analyze and test on every PR
2. Build APK/IPA on main branch
3. Deploy to stores on version tags
4. Use secrets for signing keys
5. Upload artifacts
```

### Prompt: Analytics Integration
```
Integrate Firebase Analytics and Crashlytics:
1. User tracking with ID
2. Screen view tracking
3. Custom events for key actions
4. Error logging
5. Route observer for navigation
```

### Prompt: Performance Optimization
```
Optimize Flutter app performance:
1. Image caching with size variants
2. List view with fixed extent
3. Memory management on lifecycle
4. Build configuration for release
5. Code analysis rules
```

### Prompt: Store Release
```
Prepare app for store release:
1. Android signing and flavors
2. iOS provisioning and schemes
3. App icons and splash screen
4. Store listing assets
5. Release checklist
```
