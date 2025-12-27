# Phase 2: Authentication & Profile

## Overview

This phase implements user authentication flows (login, register, OTP verification, password reset) and profile management using Flutter with Riverpod state management.

## Dependencies

```yaml
# pubspec.yaml - Phase 2 additions
dependencies:
  # Auth
  flutter_secure_storage: ^9.0.0
  local_auth: ^2.1.8

  # Forms
  flutter_form_builder: ^9.2.1
  form_builder_validators: ^9.1.0
  pinput: ^3.0.1

  # Image handling
  image_picker: ^1.0.7
  image_cropper: ^5.0.1
  cached_network_image: ^3.3.1

  # Utils
  intl: ^0.18.1
  country_code_picker: ^3.0.0
```

---

## 2.1 Authentication Domain Layer

### Entities

```dart
// lib/features/auth/domain/entities/user.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';

@freezed
class User with _$User {
  const factory User({
    required String id,
    required String phone,
    String? email,
    required String username,
    String? firstName,
    String? lastName,
    String? bio,
    String? avatarUrl,
    String? coverUrl,
    @Default(false) bool isVerified,
    @Default(false) bool isPrivate,
    required DateTime createdAt,
    DateTime? lastActiveAt,
    UserStats? stats,
  }) = _User;
}

@freezed
class UserStats with _$UserStats {
  const factory UserStats({
    @Default(0) int postsCount,
    @Default(0) int followersCount,
    @Default(0) int followingCount,
    @Default(0) int listingsCount,
  }) = _UserStats;
}
```

```dart
// lib/features/auth/domain/entities/auth_tokens.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_tokens.freezed.dart';

@freezed
class AuthTokens with _$AuthTokens {
  const factory AuthTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime expiresAt,
  }) = _AuthTokens;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  bool get needsRefresh =>
      DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 5)));
}
```

### Repository Interface

```dart
// lib/features/auth/domain/repositories/auth_repository.dart
import 'package:dartz/dartz.dart';

abstract class AuthRepository {
  /// Request OTP for phone number
  Future<Either<Failure, void>> requestOtp(String phone);

  /// Verify OTP and get tokens
  Future<Either<Failure, AuthTokens>> verifyOtp({
    required String phone,
    required String code,
  });

  /// Register new user
  Future<Either<Failure, User>> register({
    required String phone,
    required String username,
    String? firstName,
    String? lastName,
  });

  /// Get current user profile
  Future<Either<Failure, User>> getCurrentUser();

  /// Refresh access token
  Future<Either<Failure, AuthTokens>> refreshToken(String refreshToken);

  /// Logout
  Future<Either<Failure, void>> logout();

  /// Check if user is authenticated
  Future<bool> isAuthenticated();

  /// Get stored tokens
  Future<AuthTokens?> getStoredTokens();
}
```

### Use Cases

```dart
// lib/features/auth/domain/usecases/request_otp.dart
import 'package:dartz/dartz.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'request_otp.g.dart';

class RequestOtpUseCase {
  final AuthRepository _repository;

  RequestOtpUseCase(this._repository);

  Future<Either<Failure, void>> call(String phone) {
    return _repository.requestOtp(phone);
  }
}

@riverpod
RequestOtpUseCase requestOtpUseCase(RequestOtpUseCaseRef ref) {
  return RequestOtpUseCase(ref.read(authRepositoryProvider));
}
```

```dart
// lib/features/auth/domain/usecases/verify_otp.dart
class VerifyOtpUseCase {
  final AuthRepository _repository;

  VerifyOtpUseCase(this._repository);

  Future<Either<Failure, AuthTokens>> call({
    required String phone,
    required String code,
  }) {
    return _repository.verifyOtp(phone: phone, code: code);
  }
}

@riverpod
VerifyOtpUseCase verifyOtpUseCase(VerifyOtpUseCaseRef ref) {
  return VerifyOtpUseCase(ref.read(authRepositoryProvider));
}
```

---

## 2.2 Authentication Data Layer

### Models

```dart
// lib/features/auth/data/models/user_model.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

@freezed
class UserModel with _$UserModel {
  const factory UserModel({
    required String id,
    required String phone,
    String? email,
    required String username,
    @JsonKey(name: 'first_name') String? firstName,
    @JsonKey(name: 'last_name') String? lastName,
    String? bio,
    @JsonKey(name: 'avatar_url') String? avatarUrl,
    @JsonKey(name: 'cover_url') String? coverUrl,
    @JsonKey(name: 'is_verified') @Default(false) bool isVerified,
    @JsonKey(name: 'is_private') @Default(false) bool isPrivate,
    @JsonKey(name: 'created_at') required DateTime createdAt,
    @JsonKey(name: 'last_active_at') DateTime? lastActiveAt,
    UserStatsModel? stats,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);
}

extension UserModelX on UserModel {
  User toEntity() => User(
    id: id,
    phone: phone,
    email: email,
    username: username,
    firstName: firstName,
    lastName: lastName,
    bio: bio,
    avatarUrl: avatarUrl,
    coverUrl: coverUrl,
    isVerified: isVerified,
    isPrivate: isPrivate,
    createdAt: createdAt,
    lastActiveAt: lastActiveAt,
    stats: stats?.toEntity(),
  );
}

@freezed
class UserStatsModel with _$UserStatsModel {
  const factory UserStatsModel({
    @JsonKey(name: 'posts_count') @Default(0) int postsCount,
    @JsonKey(name: 'followers_count') @Default(0) int followersCount,
    @JsonKey(name: 'following_count') @Default(0) int followingCount,
    @JsonKey(name: 'listings_count') @Default(0) int listingsCount,
  }) = _UserStatsModel;

  factory UserStatsModel.fromJson(Map<String, dynamic> json) =>
      _$UserStatsModelFromJson(json);
}

extension UserStatsModelX on UserStatsModel {
  UserStats toEntity() => UserStats(
    postsCount: postsCount,
    followersCount: followersCount,
    followingCount: followingCount,
    listingsCount: listingsCount,
  );
}
```

```dart
// lib/features/auth/data/models/auth_response.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_response.freezed.dart';
part 'auth_response.g.dart';

@freezed
class AuthResponse with _$AuthResponse {
  const factory AuthResponse({
    @JsonKey(name: 'access_token') required String accessToken,
    @JsonKey(name: 'refresh_token') required String refreshToken,
    @JsonKey(name: 'expires_in') required int expiresIn,
    required UserModel user,
    @JsonKey(name: 'is_new_user') @Default(false) bool isNewUser,
  }) = _AuthResponse;

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
}

extension AuthResponseX on AuthResponse {
  AuthTokens toTokens() => AuthTokens(
    accessToken: accessToken,
    refreshToken: refreshToken,
    expiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
  );
}
```

### Data Sources

```dart
// lib/features/auth/data/datasources/auth_remote_datasource.dart
import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_remote_datasource.g.dart';

abstract class AuthRemoteDataSource {
  Future<void> requestOtp(String phone);
  Future<AuthResponse> verifyOtp(String phone, String code);
  Future<UserModel> register(RegisterRequest request);
  Future<UserModel> getCurrentUser();
  Future<AuthResponse> refreshToken(String refreshToken);
  Future<void> logout();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final ApiClient _client;

  AuthRemoteDataSourceImpl(this._client);

  @override
  Future<void> requestOtp(String phone) async {
    await _client.post('/auth/otp/request', data: {'phone': phone});
  }

  @override
  Future<AuthResponse> verifyOtp(String phone, String code) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'phone': phone, 'code': code},
    );
    return AuthResponse.fromJson(response);
  }

  @override
  Future<UserModel> register(RegisterRequest request) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/register',
      data: request.toJson(),
    );
    return UserModel.fromJson(response['user']);
  }

  @override
  Future<UserModel> getCurrentUser() async {
    final response = await _client.get<Map<String, dynamic>>('/users/me');
    return UserModel.fromJson(response);
  }

  @override
  Future<AuthResponse> refreshToken(String refreshToken) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refresh_token': refreshToken},
    );
    return AuthResponse.fromJson(response);
  }

  @override
  Future<void> logout() async {
    await _client.post('/auth/logout');
  }
}

@riverpod
AuthRemoteDataSource authRemoteDataSource(AuthRemoteDataSourceRef ref) {
  return AuthRemoteDataSourceImpl(ref.read(apiClientProvider));
}
```

```dart
// lib/features/auth/data/datasources/auth_local_datasource.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive/hive.dart';

abstract class AuthLocalDataSource {
  Future<void> saveTokens(AuthTokens tokens);
  Future<AuthTokens?> getTokens();
  Future<void> clearTokens();
  Future<void> saveUser(UserModel user);
  Future<UserModel?> getUser();
  Future<void> clearUser();
  Future<void> clearAll();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  final FlutterSecureStorage _secureStorage;
  final Box<UserModel> _userBox;

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _expiresAtKey = 'expires_at';

  AuthLocalDataSourceImpl(this._secureStorage, this._userBox);

  @override
  Future<void> saveTokens(AuthTokens tokens) async {
    await Future.wait([
      _secureStorage.write(key: _accessTokenKey, value: tokens.accessToken),
      _secureStorage.write(key: _refreshTokenKey, value: tokens.refreshToken),
      _secureStorage.write(
        key: _expiresAtKey,
        value: tokens.expiresAt.toIso8601String(),
      ),
    ]);
  }

  @override
  Future<AuthTokens?> getTokens() async {
    final accessToken = await _secureStorage.read(key: _accessTokenKey);
    final refreshToken = await _secureStorage.read(key: _refreshTokenKey);
    final expiresAtStr = await _secureStorage.read(key: _expiresAtKey);

    if (accessToken == null || refreshToken == null || expiresAtStr == null) {
      return null;
    }

    return AuthTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: DateTime.parse(expiresAtStr),
    );
  }

  @override
  Future<void> clearTokens() async {
    await Future.wait([
      _secureStorage.delete(key: _accessTokenKey),
      _secureStorage.delete(key: _refreshTokenKey),
      _secureStorage.delete(key: _expiresAtKey),
    ]);
  }

  @override
  Future<void> saveUser(UserModel user) async {
    await _userBox.put('current_user', user);
  }

  @override
  Future<UserModel?> getUser() async {
    return _userBox.get('current_user');
  }

  @override
  Future<void> clearUser() async {
    await _userBox.delete('current_user');
  }

  @override
  Future<void> clearAll() async {
    await Future.wait([
      clearTokens(),
      clearUser(),
    ]);
  }
}
```

### Repository Implementation

```dart
// lib/features/auth/data/repositories/auth_repository_impl.dart
import 'package:dartz/dartz.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_repository_impl.g.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;
  final AuthLocalDataSource _localDataSource;
  final NetworkInfo _networkInfo;

  AuthRepositoryImpl(
    this._remoteDataSource,
    this._localDataSource,
    this._networkInfo,
  );

  @override
  Future<Either<Failure, void>> requestOtp(String phone) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure('No internet connection'));
    }

    try {
      await _remoteDataSource.requestOtp(phone);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(UnexpectedFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, AuthTokens>> verifyOtp({
    required String phone,
    required String code,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure('No internet connection'));
    }

    try {
      final response = await _remoteDataSource.verifyOtp(phone, code);
      final tokens = response.toTokens();

      // Save tokens and user locally
      await _localDataSource.saveTokens(tokens);
      await _localDataSource.saveUser(response.user);

      return Right(tokens);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(UnexpectedFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> register({
    required String phone,
    required String username,
    String? firstName,
    String? lastName,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure('No internet connection'));
    }

    try {
      final request = RegisterRequest(
        phone: phone,
        username: username,
        firstName: firstName,
        lastName: lastName,
      );

      final userModel = await _remoteDataSource.register(request);
      await _localDataSource.saveUser(userModel);

      return Right(userModel.toEntity());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(UnexpectedFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, User>> getCurrentUser() async {
    try {
      // Try to get cached user first
      final cachedUser = await _localDataSource.getUser();

      if (await _networkInfo.isConnected) {
        // Fetch fresh data
        final userModel = await _remoteDataSource.getCurrentUser();
        await _localDataSource.saveUser(userModel);
        return Right(userModel.toEntity());
      } else if (cachedUser != null) {
        // Return cached data if offline
        return Right(cachedUser.toEntity());
      } else {
        return const Left(NetworkFailure('No internet connection'));
      }
    } on ServerException catch (e) {
      // If server error, try to return cached user
      final cachedUser = await _localDataSource.getUser();
      if (cachedUser != null) {
        return Right(cachedUser.toEntity());
      }
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(UnexpectedFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, AuthTokens>> refreshToken(String refreshToken) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure('No internet connection'));
    }

    try {
      final response = await _remoteDataSource.refreshToken(refreshToken);
      final tokens = response.toTokens();

      await _localDataSource.saveTokens(tokens);
      await _localDataSource.saveUser(response.user);

      return Right(tokens);
    } on ServerException catch (e) {
      // If refresh fails, clear everything
      if (e.statusCode == 401) {
        await _localDataSource.clearAll();
      }
      return Left(ServerFailure(e.message));
    } catch (e) {
      return Left(UnexpectedFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    try {
      if (await _networkInfo.isConnected) {
        await _remoteDataSource.logout();
      }
      await _localDataSource.clearAll();
      return const Right(null);
    } catch (e) {
      // Clear local data even if API call fails
      await _localDataSource.clearAll();
      return const Right(null);
    }
  }

  @override
  Future<bool> isAuthenticated() async {
    final tokens = await _localDataSource.getTokens();
    return tokens != null && !tokens.isExpired;
  }

  @override
  Future<AuthTokens?> getStoredTokens() async {
    return _localDataSource.getTokens();
  }
}

@riverpod
AuthRepository authRepository(AuthRepositoryRef ref) {
  return AuthRepositoryImpl(
    ref.read(authRemoteDataSourceProvider),
    ref.read(authLocalDataSourceProvider),
    ref.read(networkInfoProvider),
  );
}
```

---

## 2.3 Authentication Presentation Layer

### Auth State Provider

```dart
// lib/features/auth/presentation/providers/auth_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_provider.g.dart';

enum AuthStatus {
  unknown,
  authenticated,
  unauthenticated,
}

@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    @Default(AuthStatus.unknown) AuthStatus status,
    User? user,
    String? errorMessage,
  }) = _AuthState;
}

@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  FutureOr<AuthState> build() async {
    // Check initial auth status
    final repository = ref.read(authRepositoryProvider);
    final isAuth = await repository.isAuthenticated();

    if (isAuth) {
      final result = await repository.getCurrentUser();
      return result.fold(
        (failure) => const AuthState(status: AuthStatus.unauthenticated),
        (user) => AuthState(status: AuthStatus.authenticated, user: user),
      );
    }

    return const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> login(User user) async {
    state = AsyncData(AuthState(
      status: AuthStatus.authenticated,
      user: user,
    ));
  }

  Future<void> logout() async {
    final repository = ref.read(authRepositoryProvider);
    await repository.logout();
    state = const AsyncData(AuthState(status: AuthStatus.unauthenticated));
  }

  Future<void> updateUser(User user) async {
    state = AsyncData(AuthState(
      status: AuthStatus.authenticated,
      user: user,
    ));
  }

  Future<void> refreshUser() async {
    final repository = ref.read(authRepositoryProvider);
    final result = await repository.getCurrentUser();

    result.fold(
      (failure) => null, // Keep existing user on failure
      (user) => state = AsyncData(AuthState(
        status: AuthStatus.authenticated,
        user: user,
      )),
    );
  }
}

// Convenience providers
@riverpod
User? currentUser(CurrentUserRef ref) {
  return ref.watch(authNotifierProvider).valueOrNull?.user;
}

@riverpod
bool isAuthenticated(IsAuthenticatedRef ref) {
  return ref.watch(authNotifierProvider).valueOrNull?.status ==
      AuthStatus.authenticated;
}
```

### Login Provider

```dart
// lib/features/auth/presentation/providers/login_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'login_provider.g.dart';

enum LoginStep {
  phone,
  otp,
  register,
}

@freezed
class LoginState with _$LoginState {
  const factory LoginState({
    @Default(LoginStep.phone) LoginStep step,
    @Default('') String phone,
    @Default('') String otp,
    @Default(false) bool isLoading,
    @Default(false) bool isNewUser,
    String? errorMessage,
    @Default(0) int resendCountdown,
  }) = _LoginState;
}

@riverpod
class LoginNotifier extends _$LoginNotifier {
  Timer? _resendTimer;

  @override
  LoginState build() {
    ref.onDispose(() {
      _resendTimer?.cancel();
    });
    return const LoginState();
  }

  void setPhone(String phone) {
    state = state.copyWith(phone: phone, errorMessage: null);
  }

  void setOtp(String otp) {
    state = state.copyWith(otp: otp, errorMessage: null);
  }

  Future<void> requestOtp() async {
    if (state.phone.isEmpty) {
      state = state.copyWith(errorMessage: 'Phone number is required');
      return;
    }

    state = state.copyWith(isLoading: true, errorMessage: null);

    final useCase = ref.read(requestOtpUseCaseProvider);
    final result = await useCase(state.phone);

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (_) {
        state = state.copyWith(
          isLoading: false,
          step: LoginStep.otp,
        );
        _startResendCountdown();
      },
    );
  }

  Future<void> verifyOtp() async {
    if (state.otp.length != 6) {
      state = state.copyWith(errorMessage: 'Please enter 6-digit code');
      return;
    }

    state = state.copyWith(isLoading: true, errorMessage: null);

    final useCase = ref.read(verifyOtpUseCaseProvider);
    final result = await useCase(phone: state.phone, code: state.otp);

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (tokens) async {
        // Check if new user needs registration
        final authRepo = ref.read(authRepositoryProvider);
        final userResult = await authRepo.getCurrentUser();

        userResult.fold(
          (failure) {
            // User needs to register
            state = state.copyWith(
              isLoading: false,
              step: LoginStep.register,
              isNewUser: true,
            );
          },
          (user) async {
            // Existing user, login complete
            await ref.read(authNotifierProvider.notifier).login(user);
            state = state.copyWith(isLoading: false);
          },
        );
      },
    );
  }

  Future<void> resendOtp() async {
    if (state.resendCountdown > 0) return;

    state = state.copyWith(isLoading: true, errorMessage: null);

    final useCase = ref.read(requestOtpUseCaseProvider);
    final result = await useCase(state.phone);

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (_) {
        state = state.copyWith(isLoading: false);
        _startResendCountdown();
      },
    );
  }

  void _startResendCountdown() {
    state = state.copyWith(resendCountdown: 60);

    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.resendCountdown > 0) {
        state = state.copyWith(resendCountdown: state.resendCountdown - 1);
      } else {
        timer.cancel();
      }
    });
  }

  void goBack() {
    if (state.step == LoginStep.otp) {
      state = state.copyWith(step: LoginStep.phone, otp: '');
    } else if (state.step == LoginStep.register) {
      state = state.copyWith(step: LoginStep.otp);
    }
  }

  void reset() {
    _resendTimer?.cancel();
    state = const LoginState();
  }
}
```

### Phone Login Screen

```dart
// lib/features/auth/presentation/screens/phone_login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:country_code_picker/country_code_picker.dart';

class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _phoneController = TextEditingController();
  String _countryCode = '+995'; // Georgia default

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loginState = ref.watch(loginNotifierProvider);

    // Listen for step changes
    ref.listen(loginNotifierProvider, (previous, next) {
      if (next.step == LoginStep.otp) {
        context.push('/auth/otp');
      }
    });

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),

              // Logo
              Center(
                child: Image.asset(
                  'assets/images/logo.png',
                  height: 80,
                ),
              ),

              const SizedBox(height: 48),

              // Title
              Text(
                'Welcome to Bike Area',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 8),

              Text(
                'Enter your phone number to get started',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),

              const SizedBox(height: 32),

              // Phone input
              Row(
                children: [
                  // Country code picker
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: CountryCodePicker(
                      onChanged: (code) {
                        _countryCode = code.dialCode ?? '+995';
                      },
                      initialSelection: 'GE',
                      favorite: const ['GE', 'US', 'TR', 'AZ'],
                      showFlag: true,
                      showFlagDialog: true,
                      padding: EdgeInsets.zero,
                    ),
                  ),

                  const SizedBox(width: 12),

                  // Phone number
                  Expanded(
                    child: TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      decoration: InputDecoration(
                        hintText: '555 12 34 56',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 16,
                        ),
                      ),
                      onChanged: (value) {
                        ref.read(loginNotifierProvider.notifier).setPhone(
                          '$_countryCode$value',
                        );
                      },
                    ),
                  ),
                ],
              ),

              // Error message
              if (loginState.errorMessage != null) ...[
                const SizedBox(height: 16),
                Text(
                  loginState.errorMessage!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontSize: 14,
                  ),
                ),
              ],

              const Spacer(),

              // Terms
              Text(
                'By continuing, you agree to our Terms of Service and Privacy Policy',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 16),

              // Continue button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: loginState.isLoading
                      ? null
                      : () => ref.read(loginNotifierProvider.notifier).requestOtp(),
                  child: loginState.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Continue'),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
```

### OTP Verification Screen

```dart
// lib/features/auth/presentation/screens/otp_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _otpController = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    // Auto-focus on OTP input
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _otpController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loginState = ref.watch(loginNotifierProvider);
    final theme = Theme.of(context);

    // Listen for navigation
    ref.listen(loginNotifierProvider, (previous, next) {
      if (next.step == LoginStep.register) {
        context.push('/auth/register');
      }
    });

    ref.listen(authNotifierProvider, (previous, next) {
      if (next.valueOrNull?.status == AuthStatus.authenticated) {
        context.go('/');
      }
    });

    // PIN theme
    final defaultPinTheme = PinTheme(
      width: 56,
      height: 60,
      textStyle: theme.textTheme.headlineMedium,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
    );

    final focusedPinTheme = defaultPinTheme.copyWith(
      decoration: defaultPinTheme.decoration?.copyWith(
        border: Border.all(color: AppColors.primary, width: 2),
      ),
    );

    final errorPinTheme = defaultPinTheme.copyWith(
      decoration: defaultPinTheme.decoration?.copyWith(
        border: Border.all(color: theme.colorScheme.error),
      ),
    );

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(loginNotifierProvider.notifier).goBack();
            context.pop();
          },
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Enter verification code',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),

              const SizedBox(height: 8),

              Text(
                'We sent a 6-digit code to ${_formatPhone(loginState.phone)}',
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),

              const SizedBox(height: 40),

              // OTP Input
              Center(
                child: Pinput(
                  length: 6,
                  controller: _otpController,
                  focusNode: _focusNode,
                  defaultPinTheme: defaultPinTheme,
                  focusedPinTheme: focusedPinTheme,
                  errorPinTheme: errorPinTheme,
                  hapticFeedbackType: HapticFeedbackType.lightImpact,
                  onCompleted: (pin) {
                    ref.read(loginNotifierProvider.notifier).setOtp(pin);
                    ref.read(loginNotifierProvider.notifier).verifyOtp();
                  },
                  onChanged: (value) {
                    ref.read(loginNotifierProvider.notifier).setOtp(value);
                  },
                ),
              ),

              // Error message
              if (loginState.errorMessage != null) ...[
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    loginState.errorMessage!,
                    style: TextStyle(
                      color: theme.colorScheme.error,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 32),

              // Resend code
              Center(
                child: loginState.resendCountdown > 0
                    ? Text(
                        'Resend code in ${loginState.resendCountdown}s',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      )
                    : TextButton(
                        onPressed: loginState.isLoading
                            ? null
                            : () => ref.read(loginNotifierProvider.notifier).resendOtp(),
                        child: const Text('Resend code'),
                      ),
              ),

              const Spacer(),

              // Verify button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: loginState.isLoading || loginState.otp.length != 6
                      ? null
                      : () => ref.read(loginNotifierProvider.notifier).verifyOtp(),
                  child: loginState.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Verify'),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  String _formatPhone(String phone) {
    if (phone.length > 4) {
      return '${phone.substring(0, 4)} *** **${phone.substring(phone.length - 2)}';
    }
    return phone;
  }
}
```

### Registration Screen

```dart
// lib/features/auth/presentation/screens/register_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_form_builder/flutter_form_builder.dart';
import 'package:form_builder_validators/form_builder_validators.dart';
import 'package:go_router/go_router.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormBuilderState>();
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final loginState = ref.watch(loginNotifierProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete your profile'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(loginNotifierProvider.notifier).goBack();
            context.pop();
          },
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: FormBuilder(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar placeholder
                Center(
                  child: Stack(
                    children: [
                      CircleAvatar(
                        radius: 50,
                        backgroundColor: AppColors.primary.withOpacity(0.1),
                        child: const Icon(
                          Icons.person,
                          size: 50,
                          color: AppColors.primary,
                        ),
                      ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: CircleAvatar(
                          radius: 18,
                          backgroundColor: AppColors.primary,
                          child: IconButton(
                            icon: const Icon(
                              Icons.camera_alt,
                              size: 18,
                              color: Colors.white,
                            ),
                            onPressed: () {
                              // TODO: Pick avatar
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),

                // Username
                FormBuilderTextField(
                  name: 'username',
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    hintText: '@username',
                    prefixIcon: Icon(Icons.alternate_email),
                  ),
                  validator: FormBuilderValidators.compose([
                    FormBuilderValidators.required(),
                    FormBuilderValidators.minLength(3),
                    FormBuilderValidators.maxLength(30),
                    FormBuilderValidators.match(
                      r'^[a-zA-Z0-9_]+$',
                      errorText: 'Only letters, numbers, and underscores',
                    ),
                  ]),
                ),

                const SizedBox(height: 16),

                // First name
                FormBuilderTextField(
                  name: 'firstName',
                  decoration: const InputDecoration(
                    labelText: 'First name',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textCapitalization: TextCapitalization.words,
                  validator: FormBuilderValidators.compose([
                    FormBuilderValidators.required(),
                    FormBuilderValidators.minLength(2),
                  ]),
                ),

                const SizedBox(height: 16),

                // Last name
                FormBuilderTextField(
                  name: 'lastName',
                  decoration: const InputDecoration(
                    labelText: 'Last name',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textCapitalization: TextCapitalization.words,
                ),

                const SizedBox(height: 32),

                // Register button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleRegister,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Create account'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.saveAndValidate()) {
      return;
    }

    final values = _formKey.currentState!.value;
    final loginState = ref.read(loginNotifierProvider);

    setState(() => _isLoading = true);

    final repository = ref.read(authRepositoryProvider);
    final result = await repository.register(
      phone: loginState.phone,
      username: values['username'],
      firstName: values['firstName'],
      lastName: values['lastName'],
    );

    result.fold(
      (failure) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(failure.message),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      },
      (user) async {
        await ref.read(authNotifierProvider.notifier).login(user);
        if (mounted) {
          context.go('/');
        }
      },
    );
  }
}
```

---

## 2.4 Biometric Authentication

```dart
// lib/features/auth/presentation/providers/biometric_provider.dart
import 'package:local_auth/local_auth.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'biometric_provider.g.dart';

@riverpod
class BiometricNotifier extends _$BiometricNotifier {
  final _localAuth = LocalAuthentication();

  @override
  FutureOr<bool> build() async {
    return _checkBiometricAvailability();
  }

  Future<bool> _checkBiometricAvailability() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return canCheck && isDeviceSupported;
    } catch (e) {
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      return [];
    }
  }

  Future<bool> authenticate({
    String reason = 'Please authenticate to continue',
  }) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }
}

// Biometric login setting
@riverpod
class BiometricEnabled extends _$BiometricEnabled {
  static const _key = 'biometric_enabled';

  @override
  FutureOr<bool> build() async {
    final prefs = await ref.read(sharedPreferencesProvider.future);
    return prefs.getBool(_key) ?? false;
  }

  Future<void> setEnabled(bool enabled) async {
    final prefs = await ref.read(sharedPreferencesProvider.future);
    await prefs.setBool(_key, enabled);
    state = AsyncData(enabled);
  }
}
```

---

## 2.5 Profile Management

### Profile Provider

```dart
// lib/features/profile/presentation/providers/profile_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'profile_provider.g.dart';

@riverpod
class ProfileNotifier extends _$ProfileNotifier {
  @override
  FutureOr<User?> build(String userId) async {
    final currentUser = ref.read(currentUserProvider);

    // If viewing own profile, return from auth state
    if (currentUser?.id == userId) {
      return currentUser;
    }

    // Fetch other user's profile
    final repository = ref.read(userRepositoryProvider);
    final result = await repository.getUserById(userId);

    return result.fold(
      (failure) => null,
      (user) => user,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    final repository = ref.read(userRepositoryProvider);
    final result = await repository.getUserById(arg);

    state = result.fold(
      (failure) => AsyncError(failure, StackTrace.current),
      (user) => AsyncData(user),
    );
  }
}

// Own profile editing
@riverpod
class EditProfileNotifier extends _$EditProfileNotifier {
  @override
  FutureOr<void> build() => null;

  Future<bool> updateProfile({
    String? username,
    String? firstName,
    String? lastName,
    String? bio,
  }) async {
    state = const AsyncLoading();

    final repository = ref.read(userRepositoryProvider);
    final result = await repository.updateProfile(
      username: username,
      firstName: firstName,
      lastName: lastName,
      bio: bio,
    );

    return result.fold(
      (failure) {
        state = AsyncError(failure, StackTrace.current);
        return false;
      },
      (user) {
        ref.read(authNotifierProvider.notifier).updateUser(user);
        state = const AsyncData(null);
        return true;
      },
    );
  }

  Future<bool> updateAvatar(File imageFile) async {
    state = const AsyncLoading();

    final repository = ref.read(userRepositoryProvider);
    final result = await repository.updateAvatar(imageFile);

    return result.fold(
      (failure) {
        state = AsyncError(failure, StackTrace.current);
        return false;
      },
      (user) {
        ref.read(authNotifierProvider.notifier).updateUser(user);
        state = const AsyncData(null);
        return true;
      },
    );
  }

  Future<bool> updateCover(File imageFile) async {
    state = const AsyncLoading();

    final repository = ref.read(userRepositoryProvider);
    final result = await repository.updateCover(imageFile);

    return result.fold(
      (failure) {
        state = AsyncError(failure, StackTrace.current);
        return false;
      },
      (user) {
        ref.read(authNotifierProvider.notifier).updateUser(user);
        state = const AsyncData(null);
        return true;
      },
    );
  }
}
```

### Profile Screen

```dart
// lib/features/profile/presentation/screens/profile_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends ConsumerWidget {
  final String userId;

  const ProfileScreen({
    super.key,
    required this.userId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileNotifierProvider(userId));
    final currentUser = ref.watch(currentUserProvider);
    final isOwnProfile = currentUser?.id == userId;

    return profileAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Failed to load profile'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(profileNotifierProvider(userId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (user) {
        if (user == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('User not found')),
          );
        }

        return Scaffold(
          body: RefreshIndicator(
            onRefresh: () => ref.read(profileNotifierProvider(userId).notifier).refresh(),
            child: CustomScrollView(
              slivers: [
                // Cover & Avatar
                SliverAppBar(
                  expandedHeight: 200,
                  pinned: true,
                  flexibleSpace: FlexibleSpaceBar(
                    background: Stack(
                      fit: StackFit.expand,
                      children: [
                        // Cover image
                        if (user.coverUrl != null)
                          CachedNetworkImage(
                            imageUrl: user.coverUrl!,
                            fit: BoxFit.cover,
                          )
                        else
                          Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  AppColors.primary,
                                  AppColors.primaryDark,
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                          ),

                        // Gradient overlay
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                Colors.black.withOpacity(0.5),
                              ],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  actions: [
                    if (isOwnProfile)
                      IconButton(
                        icon: const Icon(Icons.settings),
                        onPressed: () => context.push('/settings'),
                      )
                    else
                      IconButton(
                        icon: const Icon(Icons.more_vert),
                        onPressed: () => _showProfileOptions(context, ref, user),
                      ),
                  ],
                ),

                // Profile info
                SliverToBoxAdapter(
                  child: Transform.translate(
                    offset: const Offset(0, -40),
                    child: Column(
                      children: [
                        // Avatar
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Theme.of(context).scaffoldBackgroundColor,
                              width: 4,
                            ),
                          ),
                          child: CircleAvatar(
                            radius: 50,
                            backgroundColor: AppColors.primary,
                            backgroundImage: user.avatarUrl != null
                                ? CachedNetworkImageProvider(user.avatarUrl!)
                                : null,
                            child: user.avatarUrl == null
                                ? Text(
                                    user.username[0].toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 36,
                                      color: Colors.white,
                                    ),
                                  )
                                : null,
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Name
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              user.displayName,
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (user.isVerified) ...[
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.verified,
                                color: AppColors.primary,
                                size: 20,
                              ),
                            ],
                          ],
                        ),

                        const SizedBox(height: 4),

                        // Username
                        Text(
                          '@${user.username}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),

                        // Bio
                        if (user.bio != null && user.bio!.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32),
                            child: Text(
                              user.bio!,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                        ],

                        const SizedBox(height: 20),

                        // Stats
                        _buildStats(context, user),

                        const SizedBox(height: 20),

                        // Action buttons
                        _buildActionButtons(context, ref, user, isOwnProfile),

                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),

                // Tabs (Posts, Listings, etc.)
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _ProfileTabBarDelegate(
                    TabBar(
                      controller: null, // TODO: Add TabController
                      tabs: const [
                        Tab(icon: Icon(Icons.grid_on)),
                        Tab(icon: Icon(Icons.directions_bike)),
                        Tab(icon: Icon(Icons.bookmark_border)),
                      ],
                    ),
                  ),
                ),

                // Tab content
                // TODO: Add tab views for posts, listings, saved
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStats(BuildContext context, User user) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _StatItem(
          count: user.stats?.postsCount ?? 0,
          label: 'Posts',
          onTap: () {},
        ),
        const SizedBox(width: 32),
        _StatItem(
          count: user.stats?.followersCount ?? 0,
          label: 'Followers',
          onTap: () => context.push('/profile/$userId/followers'),
        ),
        const SizedBox(width: 32),
        _StatItem(
          count: user.stats?.followingCount ?? 0,
          label: 'Following',
          onTap: () => context.push('/profile/$userId/following'),
        ),
      ],
    );
  }

  Widget _buildActionButtons(
    BuildContext context,
    WidgetRef ref,
    User user,
    bool isOwnProfile,
  ) {
    if (isOwnProfile) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: OutlinedButton(
          onPressed: () => context.push('/profile/edit'),
          child: const Text('Edit Profile'),
        ),
      );
    }

    final followState = ref.watch(followStatusProvider(user.id));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: followState.when(
              loading: () => ElevatedButton(
                onPressed: null,
                child: const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
              error: (_, __) => ElevatedButton(
                onPressed: () => ref.invalidate(followStatusProvider(user.id)),
                child: const Text('Error'),
              ),
              data: (isFollowing) => isFollowing
                  ? OutlinedButton(
                      onPressed: () => ref
                          .read(followStatusProvider(user.id).notifier)
                          .unfollow(),
                      child: const Text('Following'),
                    )
                  : ElevatedButton(
                      onPressed: () => ref
                          .read(followStatusProvider(user.id).notifier)
                          .follow(),
                      child: const Text('Follow'),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          IconButton.outlined(
            onPressed: () => context.push('/chat/${user.id}'),
            icon: const Icon(Icons.message_outlined),
          ),
        ],
      ),
    );
  }

  void _showProfileOptions(BuildContext context, WidgetRef ref, User user) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.share),
              title: const Text('Share Profile'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Share profile
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('Block User'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Block user
              },
            ),
            ListTile(
              leading: const Icon(Icons.flag),
              title: const Text('Report User'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Report user
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final int count;
  final String label;
  final VoidCallback onTap;

  const _StatItem({
    required this.count,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Text(
            _formatCount(count),
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
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
}

class _ProfileTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  _ProfileTabBarDelegate(this.tabBar);

  @override
  Widget build(context, shrinkOffset, overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: tabBar,
    );
  }

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  bool shouldRebuild(covariant _ProfileTabBarDelegate oldDelegate) => false;
}
```

---

## 2.6 Edit Profile Screen

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late TextEditingController _usernameController;
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _bioController;

  File? _avatarFile;
  File? _coverFile;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);

    _usernameController = TextEditingController(text: user?.username);
    _firstNameController = TextEditingController(text: user?.firstName);
    _lastNameController = TextEditingController(text: user?.lastName);
    _bioController = TextEditingController(text: user?.bio);
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final editState = ref.watch(editProfileNotifierProvider);

    return PopScope(
      canPop: !_hasChanges,
      onPopInvoked: (didPop) {
        if (!didPop && _hasChanges) {
          _showDiscardDialog();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Edit Profile'),
          actions: [
            TextButton(
              onPressed: editState.isLoading ? null : _saveProfile,
              child: editState.isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              // Cover image
              GestureDetector(
                onTap: () => _pickImage(isCover: true),
                child: Container(
                  height: 150,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: AppColors.surface,
                    image: _coverFile != null
                        ? DecorationImage(
                            image: FileImage(_coverFile!),
                            fit: BoxFit.cover,
                          )
                        : user?.coverUrl != null
                            ? DecorationImage(
                                image: CachedNetworkImageProvider(user!.coverUrl!),
                                fit: BoxFit.cover,
                              )
                            : null,
                  ),
                  child: _coverFile == null && user?.coverUrl == null
                      ? const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_photo_alternate, size: 40),
                            SizedBox(height: 8),
                            Text('Add cover photo'),
                          ],
                        )
                      : null,
                ),
              ),

              // Avatar
              Transform.translate(
                offset: const Offset(0, -40),
                child: GestureDetector(
                  onTap: () => _pickImage(isCover: false),
                  child: Stack(
                    children: [
                      CircleAvatar(
                        radius: 50,
                        backgroundColor: AppColors.primary,
                        backgroundImage: _avatarFile != null
                            ? FileImage(_avatarFile!)
                            : user?.avatarUrl != null
                                ? CachedNetworkImageProvider(user!.avatarUrl!)
                                : null,
                        child: _avatarFile == null && user?.avatarUrl == null
                            ? Text(
                                user?.username[0].toUpperCase() ?? 'U',
                                style: const TextStyle(
                                  fontSize: 36,
                                  color: Colors.white,
                                ),
                              )
                            : null,
                      ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.camera_alt,
                            size: 20,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Form fields
              TextField(
                controller: _usernameController,
                decoration: const InputDecoration(
                  labelText: 'Username',
                  prefixText: '@',
                ),
                onChanged: (_) => _markChanged(),
              ),

              const SizedBox(height: 16),

              TextField(
                controller: _firstNameController,
                decoration: const InputDecoration(
                  labelText: 'First name',
                ),
                textCapitalization: TextCapitalization.words,
                onChanged: (_) => _markChanged(),
              ),

              const SizedBox(height: 16),

              TextField(
                controller: _lastNameController,
                decoration: const InputDecoration(
                  labelText: 'Last name',
                ),
                textCapitalization: TextCapitalization.words,
                onChanged: (_) => _markChanged(),
              ),

              const SizedBox(height: 16),

              TextField(
                controller: _bioController,
                decoration: const InputDecoration(
                  labelText: 'Bio',
                  hintText: 'Tell us about yourself...',
                ),
                maxLines: 3,
                maxLength: 150,
                onChanged: (_) => _markChanged(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _markChanged() {
    if (!_hasChanges) {
      setState(() => _hasChanges = true);
    }
  }

  Future<void> _pickImage({required bool isCover}) async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take photo'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;

    final pickedFile = await picker.pickImage(source: source);
    if (pickedFile == null) return;

    // Crop image
    final croppedFile = await ImageCropper().cropImage(
      sourcePath: pickedFile.path,
      aspectRatio: isCover
          ? const CropAspectRatio(ratioX: 3, ratioY: 1)
          : const CropAspectRatio(ratioX: 1, ratioY: 1),
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: isCover ? 'Crop Cover' : 'Crop Avatar',
          toolbarColor: AppColors.primary,
          toolbarWidgetColor: Colors.white,
        ),
        IOSUiSettings(
          title: isCover ? 'Crop Cover' : 'Crop Avatar',
        ),
      ],
    );

    if (croppedFile == null) return;

    setState(() {
      if (isCover) {
        _coverFile = File(croppedFile.path);
      } else {
        _avatarFile = File(croppedFile.path);
      }
      _hasChanges = true;
    });
  }

  Future<void> _saveProfile() async {
    final notifier = ref.read(editProfileNotifierProvider.notifier);
    var success = true;

    // Update avatar if changed
    if (_avatarFile != null) {
      success = await notifier.updateAvatar(_avatarFile!);
    }

    // Update cover if changed
    if (success && _coverFile != null) {
      success = await notifier.updateCover(_coverFile!);
    }

    // Update profile data
    if (success) {
      success = await notifier.updateProfile(
        username: _usernameController.text,
        firstName: _firstNameController.text,
        lastName: _lastNameController.text,
        bio: _bioController.text,
      );
    }

    if (success && mounted) {
      Navigator.pop(context);
    }
  }

  void _showDiscardDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text('You have unsaved changes. Are you sure you want to discard them?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(this.context);
            },
            child: const Text('Discard'),
          ),
        ],
      ),
    );
  }
}
```

---

## 2.7 Follow System

```dart
// lib/features/profile/presentation/providers/follow_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'follow_provider.g.dart';

@riverpod
class FollowStatus extends _$FollowStatus {
  @override
  FutureOr<bool> build(String userId) async {
    final repository = ref.read(userRepositoryProvider);
    final result = await repository.isFollowing(userId);

    return result.fold(
      (failure) => false,
      (isFollowing) => isFollowing,
    );
  }

  Future<void> follow() async {
    state = const AsyncLoading();

    final repository = ref.read(userRepositoryProvider);
    final result = await repository.follow(arg);

    result.fold(
      (failure) => state = AsyncError(failure, StackTrace.current),
      (_) {
        state = const AsyncData(true);
        // Update profile stats
        ref.invalidate(profileNotifierProvider(arg));
      },
    );
  }

  Future<void> unfollow() async {
    state = const AsyncLoading();

    final repository = ref.read(userRepositoryProvider);
    final result = await repository.unfollow(arg);

    result.fold(
      (failure) => state = AsyncError(failure, StackTrace.current),
      (_) {
        state = const AsyncData(false);
        // Update profile stats
        ref.invalidate(profileNotifierProvider(arg));
      },
    );
  }
}

// Followers/Following lists
@riverpod
class FollowersList extends _$FollowersList {
  int _page = 1;
  bool _hasMore = true;

  @override
  FutureOr<List<User>> build(String userId) async {
    _page = 1;
    _hasMore = true;
    return _fetchFollowers();
  }

  Future<List<User>> _fetchFollowers() async {
    final repository = ref.read(userRepositoryProvider);
    final result = await repository.getFollowers(arg, page: _page);

    return result.fold(
      (failure) => throw failure,
      (users) {
        if (users.length < 20) _hasMore = false;
        return users;
      },
    );
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;

    _page++;
    final currentUsers = state.valueOrNull ?? [];

    final newUsers = await _fetchFollowers();
    state = AsyncData([...currentUsers, ...newUsers]);
  }

  bool get hasMore => _hasMore;
}

@riverpod
class FollowingList extends _$FollowingList {
  int _page = 1;
  bool _hasMore = true;

  @override
  FutureOr<List<User>> build(String userId) async {
    _page = 1;
    _hasMore = true;
    return _fetchFollowing();
  }

  Future<List<User>> _fetchFollowing() async {
    final repository = ref.read(userRepositoryProvider);
    final result = await repository.getFollowing(arg, page: _page);

    return result.fold(
      (failure) => throw failure,
      (users) {
        if (users.length < 20) _hasMore = false;
        return users;
      },
    );
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;

    _page++;
    final currentUsers = state.valueOrNull ?? [];

    final newUsers = await _fetchFollowing();
    state = AsyncData([...currentUsers, ...newUsers]);
  }

  bool get hasMore => _hasMore;
}
```

---

## 2.8 Settings Screen

```dart
// lib/features/settings/presentation/screens/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final themeMode = ref.watch(themeModeProvider);
    final biometricEnabled = ref.watch(biometricEnabledProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          // Account Section
          _SectionHeader(title: 'Account'),

          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('Edit Profile'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/profile/edit'),
          ),

          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('Privacy'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/privacy'),
          ),

          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notifications'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/notifications'),
          ),

          const Divider(),

          // Security Section
          _SectionHeader(title: 'Security'),

          biometricEnabled.when(
            loading: () => const ListTile(
              leading: Icon(Icons.fingerprint),
              title: Text('Biometric Login'),
              trailing: CircularProgressIndicator(),
            ),
            error: (_, __) => const SizedBox(),
            data: (enabled) => SwitchListTile(
              secondary: const Icon(Icons.fingerprint),
              title: const Text('Biometric Login'),
              subtitle: const Text('Use Face ID / Fingerprint to login'),
              value: enabled,
              onChanged: (value) async {
                if (value) {
                  // Verify biometric before enabling
                  final success = await ref
                      .read(biometricNotifierProvider.notifier)
                      .authenticate(reason: 'Verify to enable biometric login');

                  if (success) {
                    ref.read(biometricEnabledProvider.notifier).setEnabled(true);
                  }
                } else {
                  ref.read(biometricEnabledProvider.notifier).setEnabled(false);
                }
              },
            ),
          ),

          ListTile(
            leading: const Icon(Icons.devices),
            title: const Text('Active Sessions'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/sessions'),
          ),

          const Divider(),

          // Appearance Section
          _SectionHeader(title: 'Appearance'),

          ListTile(
            leading: const Icon(Icons.palette_outlined),
            title: const Text('Theme'),
            trailing: DropdownButton<ThemeMode>(
              value: themeMode,
              underline: const SizedBox(),
              items: const [
                DropdownMenuItem(
                  value: ThemeMode.system,
                  child: Text('System'),
                ),
                DropdownMenuItem(
                  value: ThemeMode.light,
                  child: Text('Light'),
                ),
                DropdownMenuItem(
                  value: ThemeMode.dark,
                  child: Text('Dark'),
                ),
              ],
              onChanged: (mode) {
                if (mode != null) {
                  ref.read(themeModeProvider.notifier).setThemeMode(mode);
                }
              },
            ),
          ),

          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Language'),
            trailing: const Text('Georgian'),
            onTap: () => context.push('/settings/language'),
          ),

          const Divider(),

          // Support Section
          _SectionHeader(title: 'Support'),

          ListTile(
            leading: const Icon(Icons.help_outline),
            title: const Text('Help & Support'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/help'),
          ),

          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('About'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/about'),
          ),

          const Divider(),

          // Logout
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text(
              'Logout',
              style: TextStyle(color: Colors.red),
            ),
            onTap: () => _showLogoutDialog(context, ref),
          ),

          const SizedBox(height: 32),

          // Version
          Center(
            child: Text(
              'Version 1.0.0',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await ref.read(authNotifierProvider.notifier).logout();
              if (context.mounted) {
                context.go('/auth/login');
              }
            },
            child: const Text(
              'Logout',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          color: AppColors.textSecondary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
```

---

## Testing Checklist

### Authentication Tests
- [ ] Phone number validation (Georgian format)
- [ ] OTP request flow
- [ ] OTP verification (success/failure)
- [ ] Token storage and retrieval
- [ ] Token refresh mechanism
- [ ] Registration flow for new users
- [ ] Logout clears all local data
- [ ] Biometric authentication

### Profile Tests
- [ ] View own profile
- [ ] View other user's profile
- [ ] Edit profile (name, username, bio)
- [ ] Upload/change avatar
- [ ] Upload/change cover photo
- [ ] Image cropping works correctly
- [ ] Follow/unfollow users
- [ ] Followers/following lists load

### Settings Tests
- [ ] Theme switching (light/dark/system)
- [ ] Biometric toggle works
- [ ] Logout confirmation dialog
- [ ] All settings links navigate correctly

---

## Claude Code Prompts

### Prompt: Auth Module Setup
```
Create the authentication module for Flutter with:
1. Domain layer: User entity, AuthTokens, AuthRepository interface
2. Data layer: UserModel with freezed, AuthRemoteDataSource with Dio, AuthLocalDataSource with secure storage
3. Repository implementation with proper error handling
4. Use dartz for Either type error handling
```

### Prompt: Login Flow
```
Implement the login flow with:
1. LoginNotifier with Riverpod for state management
2. PhoneLoginScreen with country code picker
3. OtpScreen with pinput for 6-digit input
4. RegisterScreen for new users with form validation
5. Auto-navigation between steps based on state
```

### Prompt: Profile Screen
```
Create the profile screen with:
1. SliverAppBar with cover image and parallax effect
2. Avatar overlapping the cover
3. Stats row (posts, followers, following)
4. Follow/unfollow button for other users
5. Tab bar for posts/listings/saved
6. Pull-to-refresh
```

### Prompt: Settings Screen
```
Create settings screen with:
1. Account section (edit profile, privacy, notifications)
2. Security section (biometric toggle, active sessions)
3. Appearance section (theme dropdown, language)
4. Support section (help, about)
5. Logout with confirmation dialog
6. Version display at bottom
```
