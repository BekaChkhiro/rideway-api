import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OptionalAuthGuard } from './guards/optional-auth.guard.js';
// Import entities directly to avoid circular dependency from barrel export
import { User } from '@database/entities/user.entity.js';
import { UserProfile } from '@database/entities/user-profile.entity.js';
import { RefreshToken } from '@database/entities/refresh-token.entity.js';
import { OtpCode } from '@database/entities/otp-code.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, RefreshToken, OtpCode]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    OptionalAuthGuard,
  ],
  exports: [
    AuthService,
    PassportModule,
    JwtModule,
    JwtAuthGuard,
    OptionalAuthGuard,
  ],
})
export class AuthModule {}
