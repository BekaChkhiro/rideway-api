import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityService } from './security.service.js';
import { RequestValidationMiddleware } from './request-validation.middleware.js';
import {
  CustomThrottlerGuard,
  AuthThrottlerGuard,
  UploadThrottlerGuard,
  SearchThrottlerGuard,
} from './throttle.guard.js';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 1000,
      },
      {
        name: 'auth',
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 10,
      },
      {
        name: 'upload',
        ttl: 60 * 1000, // 1 minute
        limit: 10,
      },
      {
        name: 'search',
        ttl: 60 * 1000, // 1 minute
        limit: 60,
      },
    ]),
  ],
  providers: [
    SecurityService,
    CustomThrottlerGuard,
    AuthThrottlerGuard,
    UploadThrottlerGuard,
    SearchThrottlerGuard,
  ],
  exports: [
    SecurityService,
    ThrottlerModule,
    CustomThrottlerGuard,
    AuthThrottlerGuard,
    UploadThrottlerGuard,
    SearchThrottlerGuard,
  ],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestValidationMiddleware).forRoutes('*');
  }
}
