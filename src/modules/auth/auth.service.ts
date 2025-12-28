import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
// Import entities directly to avoid circular dependency from barrel export
import { User } from '@database/entities/user.entity.js';
import { UserProfile } from '@database/entities/user-profile.entity.js';
import { RefreshToken } from '@database/entities/refresh-token.entity.js';
import { OtpCode, OtpType } from '@database/entities/otp-code.entity.js';
import { RedisService } from '@redis/index.js';
import { EmailService } from '@modules/email/email.service.js';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/index.js';
import {
  JwtPayload,
  JwtRefreshPayload,
  TokenResponse,
} from './interfaces/jwt-payload.interface.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const OTP_EXPIRY_MINUTES = 10;
const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly profileRepository: Repository<UserProfile>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(OtpCode)
    private readonly otpCodeRepository: Repository<OtpCode>,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(EmailService) private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; message: string }> {
    const existingUser = await this.userRepository.findOne({
      where: [{ email: dto.email }, { phone: dto.phone }],
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      if (dto.phone && existingUser.phone === dto.phone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    const existingUsername = await this.profileRepository.findOne({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = this.userRepository.create({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
    });

    await this.userRepository.save(user);

    const profile = this.profileRepository.create({
      userId: user.id,
      username: dto.username,
      fullName: dto.fullName,
    });

    await this.profileRepository.save(profile);

    await this.generateAndSaveOtp(user.id, OtpType.EMAIL_VERIFY, user.email);

    this.logger.log(`User registered: ${user.email}`);

    return {
      user: { ...user, profile } as User,
      message: 'Registration successful. Please verify your email.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<TokenResponse & { user: User }> {
    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: dto.userId,
        code: dto.code,
        type: dto.type,
      },
    });

    if (!otpCode) {
      throw new BadRequestException('Invalid OTP code');
    }

    if (otpCode.usedAt) {
      throw new BadRequestException('OTP code already used');
    }

    if (new Date() > otpCode.expiresAt) {
      throw new BadRequestException('OTP code expired');
    }

    otpCode.usedAt = new Date();
    await this.otpCodeRepository.save(otpCode);

    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (dto.type === OtpType.EMAIL_VERIFY) {
      user.isEmailVerified = true;
      // Send welcome email
      if (user.profile?.username) {
        await this.emailService.sendWelcomeEmail(
          user.email,
          user.profile.username,
        );
      }
    } else if (dto.type === OtpType.PHONE_VERIFY) {
      user.isPhoneVerified = true;
    }

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    this.logger.log(`OTP verified for user: ${user.email}, type: ${dto.type}`);

    return { ...tokens, user };
  }

  async login(
    dto: LoginDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<TokenResponse & { user: User }> {
    const user = await this.userRepository.findOne({
      where: [{ email: dto.emailOrPhone }, { phone: dto.emailOrPhone }],
      relations: ['profile'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user, deviceInfo, ipAddress);

    this.logger.log(`User logged in: ${user.email}`);

    return { ...tokens, user };
  }

  async refreshTokens(
    userId: string,
    tokenId: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<TokenResponse> {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { id: tokenId, userId },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const tokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    const isTokenValid = storedToken.tokenHash === tokenHash;

    if (!isTokenValid) {
      const isMatch = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }
    }

    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user, deviceInfo, ipAddress);

    this.logger.log(`Tokens refreshed for user: ${user.email}`);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const decoded: JwtRefreshPayload | null =
        this.jwtService.decode(refreshToken);
      const tokenId = decoded?.tokenId;
      if (tokenId) {
        await this.refreshTokenRepository.update(
          { id: tokenId, userId },
          { revokedAt: new Date() },
        );
      }
    } else {
      await this.refreshTokenRepository.update(
        { userId, revokedAt: undefined },
        { revokedAt: new Date() },
      );
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (user) {
      await this.generateAndSaveOtp(
        user.id,
        OtpType.PASSWORD_RESET,
        user.email,
      );
      this.logger.log(`Password reset OTP sent to: ${dto.email}`);
    }

    return {
      message:
        'If an account exists with this email, you will receive a password reset code.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('Invalid email or OTP code');
    }

    const otpCode = await this.otpCodeRepository.findOne({
      where: {
        userId: user.id,
        code: dto.code,
        type: OtpType.PASSWORD_RESET,
      },
    });

    if (!otpCode) {
      throw new BadRequestException('Invalid email or OTP code');
    }

    if (otpCode.usedAt) {
      throw new BadRequestException('OTP code already used');
    }

    if (new Date() > otpCode.expiresAt) {
      throw new BadRequestException('OTP code expired');
    }

    otpCode.usedAt = new Date();
    await this.otpCodeRepository.save(otpCode);

    user.passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.userRepository.save(user);

    await this.refreshTokenRepository.update(
      { userId: user.id, revokedAt: undefined },
      { revokedAt: new Date() },
    );

    this.logger.log(`Password reset for user: ${user.email}`);

    return {
      message:
        'Password reset successful. Please login with your new password.',
    };
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
    await this.redisService.set(key, '1', expiresIn);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
    return this.redisService.exists(key);
  }

  private async generateTokens(
    user: User,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<TokenResponse> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.profile?.username ?? '',
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: '',
      deviceInfo,
      ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      tokenId: refreshTokenEntity.id,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    refreshTokenEntity.tokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  private async generateAndSaveOtp(
    userId: string,
    type: OtpType,
    email?: string,
  ): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const otpCode = this.otpCodeRepository.create({
      userId,
      code,
      type,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    await this.otpCodeRepository.save(otpCode);

    // Send OTP via email
    if (
      email &&
      (type === OtpType.EMAIL_VERIFY || type === OtpType.PASSWORD_RESET)
    ) {
      const emailType = type === OtpType.EMAIL_VERIFY ? 'verify' : 'reset';
      await this.emailService.sendOtpEmail(email, code, emailType);
      this.logger.log(`OTP email sent to ${email} (type: ${type})`);
    } else {
      this.logger.debug(
        `OTP generated for user ${userId}: ${code} (type: ${type})`,
      );
    }

    return code;
  }
}
