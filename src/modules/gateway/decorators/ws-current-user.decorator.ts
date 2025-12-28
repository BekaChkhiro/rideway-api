import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AuthenticatedSocket,
  SocketUser,
} from '../interfaces/authenticated-socket.interface.js';

export const WsCurrentUser = createParamDecorator(
  (
    data: keyof SocketUser | undefined,
    ctx: ExecutionContext,
  ): SocketUser | string | undefined => {
    const client = ctx.switchToWs().getClient<AuthenticatedSocket>();
    const user = client.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
