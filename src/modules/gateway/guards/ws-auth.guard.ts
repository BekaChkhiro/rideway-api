import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface.js';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    // If user is already authenticated (from handleConnection)
    if (client.user) {
      return true;
    }

    // Try to authenticate
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Authentication token required');
    }

    try {
      const payload = await this.validateToken(token);
      client.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
      };
      return true;
    } catch {
      throw new WsException('Invalid authentication token');
    }
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    // Try to get token from handshake auth
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken.replace('Bearer ', '');
    }

    // Try to get token from query parameter
    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken.replace('Bearer ', '');
    }

    // Try to get token from headers
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      return authHeader.replace('Bearer ', '');
    }

    return null;
  }

  private async validateToken(token: string): Promise<{
    sub: string;
    email: string;
    username: string;
    type: string;
  }> {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new WsException('JWT secret not configured');
    }

    const payload = await this.jwtService.verifyAsync(token, { secret });

    if (payload.type !== 'access') {
      throw new WsException('Invalid token type');
    }

    return payload;
  }
}
