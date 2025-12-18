# Phase 2: Core Modules

## Overview

This phase focuses on building the essential core modules that other features will depend on: Authentication (JWT-based), Users (profiles, following), and Media (Cloudflare R2 integration). These modules form the foundation for all business logic.

## Goals

- Implement complete JWT authentication with refresh tokens
- Create user management with profiles and social features
- Set up Cloudflare R2 for media uploads
- Establish patterns for other modules to follow

---

## Tasks

### 2.1 Auth Module

- [ ] Create auth module structure
- [ ] Implement JWT strategy with Passport.js
- [ ] Create access token and refresh token system
- [ ] Implement registration endpoint
- [ ] Implement login endpoint
- [ ] Implement logout endpoint (token blacklist)
- [ ] Implement OTP verification (phone/email)
- [ ] Implement password reset flow
- [ ] Create auth guards (JwtAuthGuard, OptionalAuthGuard)
- [ ] Create current user decorator
- [ ] Implement token refresh endpoint
- [ ] Add rate limiting for auth endpoints

### 2.2 Users Module

- [ ] Create user entity
- [ ] Create user profile entity
- [ ] Implement get profile endpoint
- [ ] Implement update profile endpoint
- [ ] Implement avatar upload
- [ ] Implement follow/unfollow functionality
- [ ] Implement get followers list
- [ ] Implement get following list
- [ ] Implement user search
- [ ] Implement block user functionality
- [ ] Create user DTOs with validation

### 2.3 Media Module

- [ ] Set up Cloudflare R2 SDK
- [ ] Create media upload service
- [ ] Implement single image upload
- [ ] Implement multiple images upload
- [ ] Implement image deletion
- [ ] Add image validation (type, size)
- [ ] Implement image resizing/optimization
- [ ] Create presigned URL generation
- [ ] Add file type restrictions

---

## Technical Details

### Database Schema

```sql
-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- User Profiles Table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    cover_url VARCHAR(500),
    location VARCHAR(100),
    website VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Follows Table
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- User Blocks Table
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Refresh Tokens Table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- OTP Codes Table
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'email_verify', 'phone_verify', 'password_reset'
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

### JWT Token Structure

```typescript
// Access Token Payload
{
  sub: string;        // user id
  email: string;
  username: string;
  type: 'access';
  iat: number;
  exp: number;        // 15 minutes
}

// Refresh Token Payload
{
  sub: string;        // user id
  tokenId: string;    // refresh token id in database
  type: 'refresh';
  iat: number;
  exp: number;        // 7 days
}
```

### Auth Flow

```
Registration:
1. User submits email/phone + password
2. Create user record
3. Send OTP to email/phone
4. User verifies OTP
5. Return access + refresh tokens

Login:
1. User submits email/phone + password
2. Verify credentials
3. Create refresh token record
4. Return access + refresh tokens

Token Refresh:
1. Client sends refresh token
2. Verify token is valid and not revoked
3. Generate new access token
4. Optionally rotate refresh token
5. Return new tokens

Logout:
1. Client sends refresh token
2. Revoke refresh token in database
3. Optionally blacklist access token in Redis
```

### Cloudflare R2 Configuration

```typescript
// R2 Configuration
{
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL,
}

// File Upload Structure in R2
bucket/
├── avatars/
│   └── {userId}/
│       └── {timestamp}-{random}.webp
├── covers/
│   └── {userId}/
│       └── {timestamp}-{random}.webp
├── posts/
│   └── {userId}/
│       └── {postId}/
│           └── {timestamp}-{random}.webp
├── listings/
│   └── {listingId}/
│       └── {timestamp}-{random}.webp
└── stories/
    └── {userId}/
        └── {storyId}/
            └── {timestamp}-{random}.webp
```

---

## Claude Code Prompts

### Prompt 1: Create Auth Module Structure

```
Create the authentication module for the NestJS bike-area-api project:

1. Create src/modules/auth/ directory structure:
   - auth.module.ts
   - auth.controller.ts
   - auth.service.ts
   - strategies/
     - jwt.strategy.ts
     - jwt-refresh.strategy.ts
   - guards/
     - jwt-auth.guard.ts
     - optional-auth.guard.ts
   - decorators/
     - current-user.decorator.ts
     - public.decorator.ts
   - dto/
     - register.dto.ts
     - login.dto.ts
     - refresh-token.dto.ts
     - verify-otp.dto.ts
     - forgot-password.dto.ts
     - reset-password.dto.ts

2. Install required packages:
   - @nestjs/passport
   - @nestjs/jwt
   - passport
   - passport-jwt
   - bcrypt
   - @types/bcrypt

3. Create User entity (src/database/entities/user.entity.ts):
   - id (UUID)
   - email (unique)
   - phone (unique, nullable)
   - passwordHash
   - isEmailVerified
   - isPhoneVerified
   - isActive
   - lastLoginAt
   - timestamps
   - Relations: profile, refreshTokens

4. Create RefreshToken entity (src/database/entities/refresh-token.entity.ts):
   - id (UUID)
   - userId
   - tokenHash
   - deviceInfo
   - ipAddress
   - expiresAt
   - revokedAt
   - timestamps

5. Create OtpCode entity (src/database/entities/otp-code.entity.ts):
   - id (UUID)
   - userId
   - code (6 digits)
   - type (email_verify, phone_verify, password_reset)
   - expiresAt
   - usedAt
   - timestamps

6. Configure JWT module with access and refresh token secrets
7. Set access token expiration to 15 minutes
8. Set refresh token expiration to 7 days

Use bcrypt for password hashing with salt rounds of 12.
```

### Prompt 2: Implement Auth Endpoints

```
Implement authentication endpoints in the auth module:

1. POST /auth/register
   - Accept: email, password, username, fullName
   - Validate email format and password strength
   - Check if email/username already exists
   - Hash password with bcrypt
   - Create user and profile
   - Generate OTP and send to email (mock for now)
   - Return user data (without tokens until verified)

2. POST /auth/verify-otp
   - Accept: userId, code, type
   - Verify OTP is valid and not expired
   - Mark user as verified
   - Generate access and refresh tokens
   - Return tokens and user data

3. POST /auth/login
   - Accept: email/phone, password
   - Validate credentials
   - Check if user is verified and active
   - Update lastLoginAt
   - Create refresh token record
   - Return access token, refresh token, user data

4. POST /auth/refresh
   - Accept: refreshToken
   - Verify refresh token is valid
   - Check token not revoked in database
   - Generate new access token
   - Implement token rotation (optional new refresh token)
   - Return new tokens

5. POST /auth/logout
   - Require authentication
   - Accept: refreshToken (optional, for specific device)
   - Revoke refresh token(s)
   - Blacklist access token in Redis (short TTL)
   - Return success

6. POST /auth/forgot-password
   - Accept: email
   - Generate password reset OTP
   - Send OTP to email (mock)
   - Return success (don't reveal if email exists)

7. POST /auth/reset-password
   - Accept: email, code, newPassword
   - Verify OTP
   - Update password hash
   - Revoke all refresh tokens
   - Return success

8. GET /auth/me
   - Require authentication
   - Return current user with profile

Add proper error handling with specific error codes.
Add rate limiting: 5 attempts per minute for login/register.
```

### Prompt 3: Create Users Module

```
Create the users module for profile management and social features:

1. Create src/modules/users/ directory structure:
   - users.module.ts
   - users.controller.ts
   - users.service.ts
   - dto/
     - update-profile.dto.ts
     - user-query.dto.ts
   - interfaces/
     - user-response.interface.ts

2. Create UserProfile entity (src/database/entities/user-profile.entity.ts):
   - id (UUID)
   - userId (unique, relation)
   - username (unique)
   - fullName
   - bio
   - avatarUrl
   - coverUrl
   - location
   - website
   - dateOfBirth
   - gender
   - timestamps

3. Create UserFollow entity (src/database/entities/user-follow.entity.ts):
   - id (UUID)
   - followerId (relation)
   - followingId (relation)
   - createdAt
   - Unique constraint on [followerId, followingId]

4. Create UserBlock entity (src/database/entities/user-block.entity.ts):
   - id (UUID)
   - blockerId (relation)
   - blockedId (relation)
   - createdAt
   - Unique constraint on [blockerId, blockedId]

5. Implement endpoints:

   GET /users/:id
   - Get user profile by id
   - Include follower/following counts
   - Include isFollowing if authenticated
   - Exclude blocked users

   GET /users/username/:username
   - Get user by username

   PATCH /users/profile
   - Update current user's profile
   - Validate username uniqueness
   - Partial update support

   POST /users/:id/follow
   - Follow a user
   - Prevent self-follow
   - Prevent if blocked

   DELETE /users/:id/follow
   - Unfollow a user

   GET /users/:id/followers
   - Paginated list of followers
   - Include basic profile info

   GET /users/:id/following
   - Paginated list of following
   - Include basic profile info

   POST /users/:id/block
   - Block a user
   - Auto-unfollow both directions

   DELETE /users/:id/block
   - Unblock a user

   GET /users/search
   - Search users by username or name
   - Paginated results
   - Exclude blocked users

6. Add counts as virtual fields or subqueries:
   - followersCount
   - followingCount
   - postsCount (prepare for social module)

Use QueryBuilder for complex queries with counts.
```

### Prompt 4: Create Media Module with Cloudflare R2

```
Create the media module for file uploads using Cloudflare R2:

1. Create src/modules/media/ directory structure:
   - media.module.ts
   - media.controller.ts
   - media.service.ts
   - r2.service.ts
   - dto/
     - upload-response.dto.ts
   - interfaces/
     - upload-options.interface.ts

2. Install required packages:
   - @aws-sdk/client-s3
   - @aws-sdk/s3-request-presigner
   - sharp (for image processing)
   - file-type
   - multer
   - @nestjs/platform-express

3. Create src/config/r2.config.ts:
   - R2_ACCOUNT_ID
   - R2_ACCESS_KEY_ID
   - R2_SECRET_ACCESS_KEY
   - R2_BUCKET_NAME
   - R2_PUBLIC_URL
   - MAX_FILE_SIZE (10MB default)
   - ALLOWED_MIME_TYPES

4. Create R2Service (r2.service.ts):
   - Initialize S3Client with R2 endpoint
   - upload(file, path): Upload file to R2
   - delete(key): Delete file from R2
   - getSignedUrl(key, expiresIn): Generate presigned URL
   - getPublicUrl(key): Get public URL

5. Create MediaService (media.service.ts):
   - uploadImage(file, options):
     - Validate file type (jpeg, png, webp, gif)
     - Validate file size
     - Resize/optimize with Sharp
     - Convert to WebP for efficiency
     - Generate unique filename
     - Upload to R2
     - Return public URL

   - uploadImages(files, options):
     - Process multiple files
     - Return array of URLs

   - deleteImage(url):
     - Extract key from URL
     - Delete from R2

   - generateThumbnail(file, size):
     - Create thumbnail version
     - Upload separately

6. Create MediaController (media.controller.ts):

   POST /media/upload
   - Single file upload
   - Accept: file (multipart/form-data)
   - Accept: folder (avatars, posts, listings, etc.)
   - Return: { url, key, size, mimetype }

   POST /media/upload-multiple
   - Multiple files (max 10)
   - Return: array of upload results

   DELETE /media/:key
   - Delete file by key
   - Verify ownership (add metadata tracking)

7. Create file validation interceptor:
   - Check file size
   - Check mime type
   - Sanitize filename

8. Image optimization settings:
   - Avatar: 200x200, quality 80
   - Cover: 1200x400, quality 85
   - Post: max 1080px width, quality 85
   - Listing: max 1200px width, quality 85
   - Thumbnail: 300x300, quality 75

Use streams where possible for memory efficiency.
```

### Prompt 5: Implement Avatar and Cover Upload

```
Integrate media upload with user profile for avatars and covers:

1. Update UsersController to handle avatar upload:

   POST /users/avatar
   - Require authentication
   - Accept: file (multipart/form-data)
   - Validate image (jpeg, png, webp)
   - Max size: 5MB
   - Resize to 200x200
   - Convert to WebP
   - Upload to R2: avatars/{userId}/{timestamp}.webp
   - Delete old avatar if exists
   - Update user profile avatarUrl
   - Return new avatar URL

   DELETE /users/avatar
   - Require authentication
   - Delete avatar from R2
   - Set avatarUrl to null
   - Return success

   POST /users/cover
   - Require authentication
   - Accept: file (multipart/form-data)
   - Validate image
   - Max size: 10MB
   - Resize to 1200x400
   - Convert to WebP
   - Upload to R2: covers/{userId}/{timestamp}.webp
   - Delete old cover if exists
   - Update user profile coverUrl
   - Return new cover URL

   DELETE /users/cover
   - Require authentication
   - Delete cover from R2
   - Set coverUrl to null
   - Return success

2. Create custom FileInterceptor for each upload type:
   - AvatarInterceptor: size 5MB, images only
   - CoverInterceptor: size 10MB, images only

3. Add image processing pipeline in MediaService:
   - validateImage(buffer): Check magic bytes
   - processAvatar(buffer): Resize, crop to square, optimize
   - processCover(buffer): Resize, crop to ratio, optimize

4. Handle errors gracefully:
   - Invalid file type -> 400 Bad Request
   - File too large -> 413 Payload Too Large
   - Upload failed -> 500 Internal Server Error

5. Add cleanup logic:
   - If database update fails, delete uploaded file
   - Use transactions where possible
```

---

## Testing Checklist

### Auth Module Tests

- [ ] Registration creates user and profile
- [ ] Registration fails with duplicate email
- [ ] Registration fails with weak password
- [ ] OTP is generated and can be verified
- [ ] OTP expires after set time
- [ ] Login returns tokens for verified user
- [ ] Login fails for unverified user
- [ ] Login fails with wrong password
- [ ] Access token contains correct payload
- [ ] Access token expires after 15 minutes
- [ ] Refresh token works and returns new access token
- [ ] Refresh token rotation works
- [ ] Logout revokes refresh token
- [ ] Revoked refresh token cannot be used
- [ ] Password reset flow works end-to-end
- [ ] Rate limiting blocks excessive attempts

### Users Module Tests

- [ ] Get user profile returns correct data
- [ ] Get user by username works
- [ ] Update profile updates fields correctly
- [ ] Username uniqueness is enforced
- [ ] Follow creates relationship
- [ ] Cannot follow self
- [ ] Cannot follow blocked user
- [ ] Unfollow removes relationship
- [ ] Followers list is paginated
- [ ] Following list is paginated
- [ ] Block creates relationship and unfollows
- [ ] Blocked users are excluded from search
- [ ] User search returns relevant results

### Media Module Tests

- [ ] Single image upload works
- [ ] Multiple images upload works
- [ ] Invalid file type is rejected
- [ ] File too large is rejected
- [ ] Image is resized correctly
- [ ] Image is converted to WebP
- [ ] Delete removes file from R2
- [ ] Avatar upload updates profile
- [ ] Cover upload updates profile
- [ ] Old files are cleaned up on update

### Integration Tests

- [ ] Full registration -> OTP -> login flow
- [ ] Full password reset flow
- [ ] Upload avatar -> verify in profile
- [ ] Follow user -> appears in followers list
- [ ] Block user -> excluded from feed/search

### გ
---

## Completion Criteria

Phase 2 is complete when:

1. **Authentication works end-to-end**
   - Registration, verification, login, logout
   - Token refresh and rotation
   - Password reset

2. **User management is functional**
   - Profile CRUD
   - Follow/unfollow system
   - Block functionality
   - User search

3. **Media upload works with R2**
   - Images upload and serve correctly
   - Avatar and cover management
   - Image optimization works

4. **All tests pass**
   - Unit tests for services
   - Integration tests for flows
   - E2E tests for endpoints

5. **Security is implemented**
   - Passwords are hashed
   - Tokens are secure
   - Rate limiting is active
   - Input validation works

---

## Notes

- Keep refresh tokens secure - use httpOnly cookies for web
- Implement token blacklist with short TTL in Redis
- Consider adding device/session management later
- Monitor R2 usage and costs
- Add proper logging for security events
