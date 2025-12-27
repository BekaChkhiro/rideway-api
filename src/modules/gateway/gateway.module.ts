import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@redis/redis.module.js';
import { AppGateway } from './gateway.gateway.js';
import { GatewayService } from './gateway.service.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';

@Module({
  imports: [
    RedisModule,
    ConfigModule,
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
  exports: [GatewayService],
})
export class GatewayModule {}
