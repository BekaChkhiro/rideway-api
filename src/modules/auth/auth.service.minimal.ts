import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@database/entities/user.entity.js';
import { UserProfile } from '@database/entities/user-profile.entity.js';
import { RefreshToken } from '@database/entities/refresh-token.entity.js';
import { OtpCode } from '@database/entities/otp-code.entity.js';

@Injectable()
export class AuthServiceMinimal {
  private readonly logger = new Logger(AuthServiceMinimal.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('AuthServiceMinimal constructor called');
  }

  test(): string {
    return 'AuthService is working';
  }
}
