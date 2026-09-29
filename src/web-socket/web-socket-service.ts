import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from 'src/config/env';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { EnumWebSocketEventType } from 'src/common/enums/web-socket-events';
import { INotification } from 'src/common/interfaces/notification';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [
      env.clientFrontendUrl,
      env.restaurantFrontendUrl,
      env.adminFrontendUrl,
    ],
    credentials: true,
  },
  transports: ['websocket'],
})
export class WebSocketService
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(WebSocketService.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    this.logger.log('[WebSocket] WebSocket initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // 1️⃣ Extract and verify token
      const token =
        client.handshake.headers['token'] || client.handshake.auth?.token;
      if (!token) {
        this.logger.warn(
          `[WebSocket] Client ${client.id} connected without token — disconnecting`,
        );
        client.disconnect();
        return;
      }

      const payload = (await this.jwtService.verifyAsync(token, {
        secret: env.accessTokenSecret,
      })) as ILoggedInUserTokenData;

      // 2️⃣ Attach user to socket for later use
      client.data.user = payload;

      // 3️⃣ Join a room named after the user's id
      const userRoom = `user:${payload.id}`;
      await client.join(userRoom);

      this.logger.log(
        `[WebSocket] Client ${client.id} connected — joined room ${userRoom}`,
      );
    } catch (error) {
      this.logger.warn(
        `[WebSocket] Client ${client.id} authentication failed — disconnecting`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub;
    this.logger.log(
      `[WebSocket] Client ${client.id} disconnected — user:${userId ?? 'unknown'}`,
    );
  }

  // 📡 Emit to a specific user's room
  emitToUser<INotification>({
    data,
    event,
    userId,
  }: {
    userId: string;
    event: EnumWebSocketEventType;
    data: INotification;
  }) {
    const targetRoom = `user:${userId}`;

    this.logger.log(
      `[WebSocket] 📡 Emitting event [${event}] to room [${targetRoom}]`,
    );

    // Optional: Log the stringified data payload if it is small enough for your console
    this.logger.log(
      `[WebSocket] Payload for [${targetRoom}]: ${JSON.stringify(data)}`,
    );

    this.server.to(targetRoom).emit(event, data);

    this.logger.log(
      `[WebSocket] ✅ Event [${event}] emitted to room [${targetRoom}]`,
    );
  }

  // 📡 Emit to a list of users' rooms
  emitToUsers({
    userIds,
    event,
    data,
  }: {
    userIds: string[];
    event: EnumWebSocketEventType;
    data: INotification<any>;
  }) {
    const targetRooms = userIds.map((id) => `user:${id}`);

    this.logger.log(
      `[WebSocket] 📡 Emitting event [${event}] to ${targetRooms.length} room(s): [${targetRooms.join(', ')}]`,
    );

    this.logger.log(
      `[WebSocket] Payload for [${targetRooms.join(', ')}]: ${JSON.stringify(data)}`,
    );

    this.server.to(targetRooms).emit(event, data);

    this.logger.log(
      `[WebSocket] ✅ Event [${event}] emitted to ${targetRooms.length} room(s): [${targetRooms.join(', ')}]`,
    );
  }
}
