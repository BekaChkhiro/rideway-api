import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { DeviceToken, DeviceType } from '@database/index.js';
import { RegisterDeviceDto, DeviceInfo } from './fcm.interfaces.js';

@Injectable()
export class DeviceTokensService {
  private readonly logger = new Logger(DeviceTokensService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  /**
   * Register or update a device token
   */
  async register(userId: string, dto: RegisterDeviceDto): Promise<DeviceToken> {
    const { token, deviceType, deviceName, deviceId } = dto;

    // Check if token already exists for this user
    let deviceToken = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });

    if (deviceToken) {
      // Update existing token
      deviceToken.deviceType = deviceType as DeviceType;
      deviceToken.deviceName = deviceName;
      deviceToken.deviceId = deviceId;
      deviceToken.isActive = true;
      deviceToken.lastUsedAt = new Date();
    } else {
      // Check if token exists for another user (device changed hands)
      const existingToken = await this.deviceTokenRepository.findOne({
        where: { token },
      });

      if (existingToken) {
        // Deactivate old token
        await this.deviceTokenRepository.update(existingToken.id, {
          isActive: false,
        });
      }

      // If deviceId provided, deactivate old tokens for same device
      if (deviceId) {
        await this.deviceTokenRepository.update(
          { userId, deviceId, isActive: true },
          { isActive: false },
        );
      }

      // Create new token
      deviceToken = this.deviceTokenRepository.create({
        userId,
        token,
        deviceType: deviceType as DeviceType,
        deviceName,
        deviceId,
        isActive: true,
        lastUsedAt: new Date(),
      });
    }

    await this.deviceTokenRepository.save(deviceToken);

    this.logger.debug(
      `Registered device token for user ${userId}: ${deviceType}`,
    );

    return deviceToken;
  }

  /**
   * Unregister a device token
   */
  async unregister(userId: string, token: string): Promise<boolean> {
    const result = await this.deviceTokenRepository.update(
      { userId, token },
      { isActive: false },
    );

    if (result.affected && result.affected > 0) {
      this.logger.debug(`Unregistered device token for user ${userId}`);
      return true;
    }

    return false;
  }

  /**
   * Unregister all tokens for a user (on logout from all devices)
   */
  async unregisterAll(userId: string): Promise<number> {
    const result = await this.deviceTokenRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    this.logger.debug(
      `Unregistered ${result.affected} device tokens for user ${userId}`,
    );

    return result.affected || 0;
  }

  /**
   * Get all active tokens for a user
   */
  async getActiveTokens(userId: string): Promise<string[]> {
    const tokens = await this.deviceTokenRepository.find({
      where: { userId, isActive: true },
      select: ['token'],
    });

    return tokens.map((t) => t.token);
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const devices = await this.deviceTokenRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    return devices.map((d) => ({
      id: d.id,
      deviceType: d.deviceType,
      deviceName: d.deviceName,
      isActive: d.isActive,
      lastUsedAt: d.lastUsedAt,
      createdAt: d.createdAt,
    }));
  }

  /**
   * Remove invalid/expired tokens
   */
  async removeInvalidTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;

    const result = await this.deviceTokenRepository.update(
      { token: In(tokens) },
      { isActive: false },
    );

    this.logger.log(`Marked ${result.affected} invalid tokens as inactive`);

    return result.affected || 0;
  }

  /**
   * Delete inactive tokens older than specified days
   */
  async deleteInactive(days: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.deviceTokenRepository.delete({
      isActive: false,
      updatedAt: LessThan(cutoffDate),
    });

    this.logger.log(`Deleted ${result.affected} inactive device tokens`);

    return result.affected || 0;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(token: string): Promise<void> {
    await this.deviceTokenRepository.update(
      { token, isActive: true },
      { lastUsedAt: new Date() },
    );
  }

  /**
   * Get active token count for user
   */
  async getActiveTokenCount(userId: string): Promise<number> {
    return this.deviceTokenRepository.count({
      where: { userId, isActive: true },
    });
  }
}
