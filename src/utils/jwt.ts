import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { AuthPayload } from '../types/api';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function generateAccessToken(payload: AuthPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwt.accessExpiry as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.accessSecret, options);
}

export function generateRefreshToken(payload: AuthPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiry as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
}

export function generateTokens(payload: AuthPayload): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, config.jwt.accessSecret) as AuthPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as AuthPayload;
  } catch {
    return null;
  }
}
