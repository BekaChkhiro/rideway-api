# Phase 1: Foundation

## Overview

This phase establishes the project foundation. We will set up the NestJS project, configure the database connection with PostgreSQL, set up Redis for caching and sessions, and create the Docker development environment.

## Goals

- Initialize NestJS project with proper structure
- Configure PostgreSQL with TypeORM
- Set up Redis connection
- Create Docker Compose for local development
- Establish coding standards and configurations

---

## Tasks

### 1.1 Project Initialization

- [ ] Create NestJS project with CLI
- [ ] Configure TypeScript strict mode
- [ ] Set up ESLint and Prettier
- [ ] Configure path aliases
- [ ] Create folder structure

### 1.2 Environment Configuration

- [ ] Create `.env.example` file
- [ ] Set up ConfigModule with validation
- [ ] Create configuration files for each service
- [ ] Set up environment-specific configs (dev, staging, prod)

### 1.3 Database Setup (PostgreSQL + TypeORM)

- [ ] Install TypeORM and PostgreSQL driver
- [ ] Configure TypeORM module
- [ ] Create base entity with common fields
- [ ] Set up migrations system
- [ ] Create database seeding infrastructure

### 1.4 Redis Setup

- [ ] Install Redis packages (ioredis)
- [ ] Create Redis module
- [ ] Configure Redis connection
- [ ] Create caching service
- [ ] Set up Redis health check

### 1.5 Docker Development Environment

- [ ] Create Dockerfile for API
- [ ] Create docker-compose.yml
- [ ] Configure PostgreSQL container
- [ ] Configure Redis container
- [ ] Set up volumes and networks

### 1.6 Common Utilities

- [ ] Create response interceptor (standard API responses)
- [ ] Create global exception filter
- [ ] Create validation pipe configuration
- [ ] Create logging interceptor
- [ ] Set up Swagger documentation

---

## Technical Details

### Folder Structure

```
src/
├── app.module.ts
├── main.ts
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── config.module.ts
├── database/
│   ├── database.module.ts
│   ├── entities/
│   │   └── base.entity.ts
│   ├── migrations/
│   └── seeds/
│       └── seed.ts
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
└── common/
    ├── decorators/
    ├── guards/
    ├── interceptors/
    │   ├── response.interceptor.ts
    │   └── logging.interceptor.ts
    ├── filters/
    │   └── http-exception.filter.ts
    └── pipes/
```

### Base Entity

```typescript
// src/database/entities/base.entity.ts
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
```

### Standard API Response Format

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [...]
  }
}
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: bike_area
      POSTGRES_PASSWORD: bike_area_dev
      POSTGRES_DB: bike_area
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Claude Code Prompts

### Prompt 1: Initialize NestJS Project

```
Create a new NestJS project for bike-area-api with the following requirements:

1. Initialize NestJS project using @nestjs/cli
2. Configure TypeScript with strict mode enabled
3. Set up ESLint with @typescript-eslint and Prettier
4. Configure path aliases in tsconfig.json:
   - @modules/* -> src/modules/*
   - @common/* -> src/common/*
   - @config/* -> src/config/*
   - @database/* -> src/database/*

5. Create the folder structure:
   - src/modules/
   - src/common/decorators/
   - src/common/guards/
   - src/common/interceptors/
   - src/common/filters/
   - src/common/pipes/
   - src/config/
   - src/database/entities/
   - src/database/migrations/
   - src/database/seeds/

6. Add these scripts to package.json:
   - "migration:generate": "typeorm migration:generate"
   - "migration:run": "typeorm migration:run"
   - "migration:revert": "typeorm migration:revert"
   - "seed": "ts-node src/database/seeds/seed.ts"

7. Create .env.example with all required environment variables
8. Create .gitignore with proper entries

Install required dependencies:
- @nestjs/config
- @nestjs/typeorm
- typeorm
- pg
- ioredis
- @nestjs/swagger
- swagger-ui-express
- class-validator
- class-transformer
- helmet
- compression
```

### Prompt 2: Configure Database and TypeORM

```
Set up PostgreSQL database connection with TypeORM in the NestJS project:

1. Create src/config/database.config.ts:
   - Use @nestjs/config to load environment variables
   - Configure TypeORM options (host, port, username, password, database)
   - Enable SSL for production
   - Configure connection pooling
   - Set synchronize: false (use migrations)
   - Configure logging for development

2. Create src/database/database.module.ts:
   - Import TypeOrmModule.forRootAsync
   - Use ConfigService to inject configuration
   - Register entities dynamically

3. Create src/database/entities/base.entity.ts:
   - UUID primary key
   - createdAt timestamp
   - updatedAt timestamp
   - deletedAt for soft deletes

4. Create src/config/config.module.ts:
   - Global configuration module
   - Environment validation with Joi
   - Load all config files

5. Set up TypeORM CLI configuration (typeorm.config.ts) for migrations

6. Create initial migration for any base tables if needed

Make sure all database operations use snake_case for column names.
```

### Prompt 3: Configure Redis Module

```
Set up Redis module for caching and session management:

1. Create src/config/redis.config.ts:
   - Load REDIS_URL from environment
   - Configure connection options
   - Set up retry strategy
   - Configure max retries

2. Create src/redis/redis.module.ts:
   - Global module
   - Create Redis client provider
   - Export RedisService

3. Create src/redis/redis.service.ts with methods:
   - get(key: string): Promise<string | null>
   - set(key: string, value: string, ttl?: number): Promise<void>
   - del(key: string): Promise<void>
   - exists(key: string): Promise<boolean>
   - expire(key: string, ttl: number): Promise<void>
   - keys(pattern: string): Promise<string[]>
   - hget(key: string, field: string): Promise<string | null>
   - hset(key: string, field: string, value: string): Promise<void>
   - hdel(key: string, field: string): Promise<void>
   - hgetall(key: string): Promise<Record<string, string>>
   - publish(channel: string, message: string): Promise<void>
   - subscribe(channel: string, callback: Function): Promise<void>

4. Create health check endpoint for Redis

5. Add proper error handling and logging

Use ioredis package for Redis client.
```

### Prompt 4: Create Docker Development Environment

```
Set up Docker development environment for the project:

1. Create Dockerfile:
   - Use node:20-alpine as base
   - Multi-stage build (development and production)
   - Install dependencies
   - Copy source code
   - Expose port 3000

2. Create docker-compose.yml with services:
   - api: NestJS application
     - Build from Dockerfile
     - Mount source code as volume
     - Hot reload enabled
     - Depends on postgres and redis

   - postgres: PostgreSQL 15
     - Alpine image
     - Persistent volume for data
     - Environment variables for user/password/database
     - Health check

   - redis: Redis 7
     - Alpine image
     - Persistent volume
     - Health check

3. Create docker-compose.override.yml for local development specifics

4. Create .dockerignore file

5. Add npm scripts:
   - "docker:up": "docker-compose up -d"
   - "docker:down": "docker-compose down"
   - "docker:logs": "docker-compose logs -f"
   - "docker:build": "docker-compose build"

Ensure hot reload works with volume mounting.
```

### Prompt 5: Create Common Utilities

```
Create common utilities and interceptors for the NestJS API:

1. Create src/common/interceptors/response.interceptor.ts:
   - Transform all responses to standard format
   - Format: { success: true, data: {...}, meta: {...} }
   - Handle pagination metadata

2. Create src/common/filters/http-exception.filter.ts:
   - Catch all HTTP exceptions
   - Format: { success: false, error: { code, message, details } }
   - Log errors appropriately
   - Different handling for development vs production

3. Create src/common/interceptors/logging.interceptor.ts:
   - Log incoming requests (method, URL, user)
   - Log response time
   - Use NestJS Logger

4. Create src/common/pipes/validation.pipe.ts:
   - Extend ValidationPipe
   - Configure whitelist and forbidNonWhitelisted
   - Custom error formatting

5. Create src/common/decorators/api-response.decorator.ts:
   - Swagger decorator for standard responses
   - Combine common response decorators

6. Set up Swagger in main.ts:
   - Configure title, description, version
   - Add bearer auth
   - Configure tags for modules

7. Update main.ts to use all interceptors, filters, and pipes globally

8. Add helmet and compression middleware
```

---

## Testing Checklist

### Unit Tests

- [ ] ConfigService loads environment variables correctly
- [ ] Database connection configuration is valid
- [ ] Redis service methods work correctly (mock Redis)
- [ ] Response interceptor transforms data correctly
- [ ] Exception filter formats errors correctly
- [ ] Validation pipe validates DTOs correctly

### Integration Tests

- [ ] Application bootstraps without errors
- [ ] Database connection is established
- [ ] Redis connection is established
- [ ] Health check endpoint returns OK
- [ ] Swagger documentation is accessible at /api/docs

### Docker Tests

- [ ] `docker-compose up` starts all services
- [ ] API container can connect to PostgreSQL
- [ ] API container can connect to Redis
- [ ] Hot reload works when changing source files
- [ ] Volumes persist data after restart

### Manual Verification

- [ ] Visit http://localhost:3000/api/docs - Swagger loads
- [ ] Visit http://localhost:3000/health - Returns healthy status
- [ ] Check PostgreSQL connection: `docker-compose exec postgres psql -U bike_area -d bike_area`
- [ ] Check Redis connection: `docker-compose exec redis redis-cli ping`

---

## Completion Criteria

Phase 1 is complete when:

1. **Project runs locally** with `npm run start:dev`
2. **Docker environment works** with `docker-compose up`
3. **Database connection** is established and migrations run
4. **Redis connection** is established and caching works
5. **Swagger documentation** is accessible at `/api/docs`
6. **Health check endpoint** returns healthy status
7. **All tests pass** with `npm run test`
8. **Code follows standards** - ESLint and Prettier pass

---

## Notes

- Keep dependencies up to date during development
- Document any deviations from the plan
- If issues arise, update this document with solutions
- Commit frequently with meaningful messages
