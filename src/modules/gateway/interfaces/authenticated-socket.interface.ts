import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from './socket-events.interface.js';

export interface SocketUser {
  id: string;
  email: string;
  username?: string;
}

export interface AuthenticatedSocket
  extends Socket<ClientToServerEvents, ServerToClientEvents> {
  user: SocketUser;
}

export interface SocketData {
  user?: SocketUser;
}
