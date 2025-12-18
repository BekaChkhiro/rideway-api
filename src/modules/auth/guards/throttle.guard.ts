import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const forwarded = req.headers as Record<string, string | string[]>;
    const xForwardedFor = forwarded['x-forwarded-for'];
    const ip = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor?.split(',')[0] || (req.ip as string);
    return Promise.resolve(ip);
  }
}
