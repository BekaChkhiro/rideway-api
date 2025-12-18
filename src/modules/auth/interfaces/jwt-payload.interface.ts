export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
