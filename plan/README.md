# Bike Area API - Backend Development Plan

## Project Overview

This document outlines the complete backend development plan for the Bike Area mobile application. The backend will be built from scratch, migrating from Supabase to a custom NestJS solution for better performance, reliability, and control.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | NestJS + Express | API server |
| Database | PostgreSQL | Primary data storage |
| Cache | Redis | Caching, sessions, pub/sub |
| Media Storage | Cloudflare R2 | Images, files |
| Authentication | JWT + Passport.js | User authentication |
| Real-time | Socket.io | Chat, notifications |
| Queue | BullMQ | Background jobs |
| Push Notifications | Firebase Cloud Messaging | Mobile push |
| Hosting | Railway | Cloud deployment |

## Project Structure

```
bike-area-api/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── media/
│   │   ├── marketplace/
│   │   ├── social/
│   │   ├── forum/
│   │   ├── services/
│   │   ├── chat/
│   │   └── notifications/
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   └── pipes/
│   ├── config/
│   ├── database/
│   │   ├── entities/
│   │   ├── migrations/
│   │   └── seeds/
│   └── main.ts
├── test/
├── docker-compose.yml
├── .env.example
└── package.json
```

## Development Phases

### [Phase 1: Foundation](./phase-1-foundation.md)
Setting up the project foundation including NestJS initialization, database configuration, Redis setup, and basic project structure.

**Estimated Scope:** Project setup, Database, Redis, Docker, Environment configuration

---

### [Phase 2: Core Modules](./phase-2-core-modules.md)
Building the essential modules: Authentication, Users, and Media handling.

**Estimated Scope:** Auth (JWT), Users (CRUD, profiles), Media (Cloudflare R2)

---

### [Phase 3: Business Logic](./phase-3-business-logic.md)
Implementing the main business features: Marketplace, Social, Forum, and Services.

**Estimated Scope:** Listings, Parts, Posts, Stories, Comments, Threads, Reviews

---

### [Phase 4: Real-time & Notifications](./phase-4-realtime.md)
Adding real-time capabilities and notification systems.

**Estimated Scope:** Socket.io, Chat, Push notifications, BullMQ queues

---

### [Phase 5: Production Ready](./phase-5-production.md)
Security hardening, performance optimization, and deployment setup.

**Estimated Scope:** Security, Caching, CI/CD, Monitoring, Railway deployment

---

## Migration Strategy

### Data Migration from Supabase
1. Export existing data from Supabase PostgreSQL
2. Transform data to match new schema if needed
3. Import into Railway PostgreSQL
4. Verify data integrity
5. Update mobile app to use new API endpoints

### Gradual Rollout
1. Deploy backend to Railway
2. Test with staging environment
3. Update mobile app with feature flags
4. Gradually route traffic to new backend
5. Full cutover after verification

## Environment Variables

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=bike-area
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# App URLs
FRONTEND_URL=https://your-app.com
```

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run in development
npm run start:dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Build for production
npm run build

# Run production
npm run start:prod

# Database migrations
npm run migration:run

# Generate migration
npm run migration:generate

# Seed database
npm run seed
```

## Progress Tracking

- [ ] Phase 1: Foundation
- [ ] Phase 2: Core Modules
- [ ] Phase 3: Business Logic
- [ ] Phase 4: Real-time & Notifications
- [ ] Phase 5: Production Ready

---

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Railway Documentation](https://docs.railway.app/)
