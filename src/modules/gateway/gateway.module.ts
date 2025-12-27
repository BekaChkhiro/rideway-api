import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@redis/redis.module.js';
import { UserActivity, UserFollow } from '@database/index.js';
import { AppGateway } from './gateway.gateway.js';
import { GatewayService } from './gateway.service.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';

@Module({
  imports: [
    RedisModule,
    ConfigModule,
    TypeOrmModule.forFeature([UserActivity, UserFollow]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  providers: [AppGateway, GatewayService, WsAuthGuard],
  exports: [GatewayService, WsAuthGuard, JwtModule],
})
export class GatewayModule {}
