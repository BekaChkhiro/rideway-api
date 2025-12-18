import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/index.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { User } from '@database/index.js';
import { JwtRefreshPayload } from './interfaces/jwt-payload.interface.js';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/phone and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    return this.authService.login(dto, deviceInfo, ipAddress);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const decoded = this.decodeRefreshToken(dto.refreshToken);
    const deviceInfo = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    return this.authService.refreshTokens(
      decoded.sub,
      decoded.tokenId,
      dto.refreshToken,
      deviceInfo,
      ipAddress,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser() user: User, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(user.id, dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ auth: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({
    status: 200,
    description: 'Password reset OTP sent if email exists',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many password reset attempts',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid email or OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() user: User) {
    return this.authService.getCurrentUser(user.id);
  }

  private decodeRefreshToken(token: string): JwtRefreshPayload {
    try {
      const decoded = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      ) as JwtRefreshPayload;
      return decoded;
    } catch {
      throw new Error('Invalid refresh token format');
    }
  }
}
