import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { User, UserProfile, UserFollow, UserBlock } from '@database/index.js';
import { MediaModule } from '@modules/media/media.module.js';
import { GatewayModule } from '@modules/gateway/gateway.module.js';
import { AuthModule } from '@modules/auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, UserFollow, UserBlock]),
    MediaModule,
    AuthModule,
    forwardRef(() => GatewayModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
