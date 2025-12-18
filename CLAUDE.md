# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bike Area API is a NestJS backend for a motorcycle community mobile application. The project is migrating from Supabase to a custom NestJS solution for better performance and control.

## Technology Stack

- **Framework**: NestJS + Express
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis (ioredis)
- **Media Storage**: Cloudflare R2
- **Authentication**: JWT + Passport.js
- **Real-time**: Socket.io with Redis adapter
- **Background Jobs**: BullMQ
- **Push Notifications**: Firebase Cloud Messaging
- **Deployment**: Railway

## Commands

```bash
# Development
npm run start:dev          # Run in development mode with hot reload
npm run build              # Build for production
npm run start:prod         # Run production build

# Testing
npm run test               # Run unit tests
npm run test:cov           # Run tests with coverage
npm run test:e2e           # Run end-to-end tests

# Database
npm run migration:generate # Generate new migration
npm run migration:run      # Run pending migrations
npm run migration:revert   # Revert last migration
npm run seed               # Seed database

# Docker
npm run docker:up          # Start containers
npm run docker:down        # Stop containers
npm run docker:logs        # View container logs
```

## Architecture

### Project Structure
```
src/
├── modules/           # Feature modules (auth, users, media, marketplace, social, forum, services, chat, notifications)
├── common/            # Shared code (decorators, guards, interceptors, filters, pipes)
├── config/            # Configuration files (app, database, redis, r2, firebase)
├── database/          # TypeORM entities, migrations, seeds
└── main.ts
```

### Module Pattern
Each feature module follows NestJS conventions:
- `*.module.ts` - Module definition
- `*.controller.ts` - HTTP endpoints
- `*.service.ts` - Business logic
- `*.gateway.ts` - WebSocket handlers (for real-time modules)
- `dto/` - Data transfer objects with class-validator decorators
- `entities/` - TypeORM entity definitions

### Key Patterns

**Base Entity**: All entities extend a base entity with UUID primary key, `createdAt`, `updatedAt`, and soft-delete `deletedAt`.

**API Response Format**:
```typescript
// Success: { success: true, data: {...}, meta: {...} }
// Error: { success: false, error: { code, message, details } }
```

**Database Conventions**: Use snake_case for column names in PostgreSQL.

**Caching**: Cache keys follow pattern `entity:type:id` (e.g., `user:profile:uuid`).

### Development Phases

The project follows a 5-phase development plan documented in `plan/`:
1. **Foundation** - Project setup, database, Redis, Docker
2. **Core Modules** - Auth (JWT), Users, Media (R2)
3. **Business Logic** - Marketplace, Social, Forum, Services
4. **Real-time** - Socket.io, Chat, Push notifications
5. **Production** - Security, caching, CI/CD, deployment

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` - JWT signing secrets (min 32 chars)
- `R2_*` - Cloudflare R2 credentials for media storage
- `FIREBASE_*` - FCM credentials for push notifications
