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
import { stringToArray } from 'src/common/utils/string-to-array';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { WebSocketEventType } from 'src/common/enums/web-socket-events';

@Injectable()
@WebSocketGateway({
  cors: { origin: stringToArray(env.allowedOrigins), credentials: true },
  transports: ['websocket'],
})
export class WebSocketService
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(WebSocket.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    this.logger.log('WebSocket initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // 1️⃣ Extract and verify token
      const token =
        client.handshake.headers['token'] || client.handshake.auth?.token;
      if (!token) {
        this.logger.warn(
          `Client ${client.id} connected without token — disconnecting`,
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
        `Client ${client.id} connected — joined room ${userRoom}`,
      );
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} authentication failed — disconnecting`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub;
    this.logger.log(
      `Client ${client.id} disconnected — user:${userId ?? 'unknown'}`,
    );
  }

  // 📡 Emit to a specific user's room
  emitToUser<T>(userId: string, event: WebSocketEventType, data: T) {
    const targetRoom = `user:${userId}`;

    this.logger.log(`📡 Emitting event [${event}] to room [${targetRoom}]`);

    // Optional: Log the stringified data payload if it is small enough for your console
    this.logger.log(`Payload for [${targetRoom}]: ${JSON.stringify(data)}`);

    this.server.to(targetRoom).emit(event, data);
  }

  // 📡 Emit to a list of users' rooms
  emitToUsers<T>(userIds: string[], event: WebSocketEventType, data: T) {
    const targetRooms = userIds.map((id) => `user:${id}`);

    this.logger.log(
      `📡 Emitting event [${event}] to ${targetRooms.length} room(s): [${targetRooms.join(', ')}]`,
    );

    this.server.to(targetRooms).emit(event, data);
  }
}

// @Injectable()
// export class UsersService {
//   constructor(
//     private readonly eventsGateway: EventsGateway,
//     @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
//   ) {}

//   async create(dto: CreateUserDto) {
//     const user = await new this.userModel(dto).save();

//     // 📡 Send only to the created user's room
// this.eventsGateway.emitToUser(user.id, 'user.created', {
//   id: user.id,
//   name: user.name,
//   role: user.role,
// });

//     return OrchestrationResult.Success({
//       statusCode: EnumStatusCode.CREATED,
//       data: user.parsePublic(),
//     });
//   }
// }

// // REACT

// // src/hooks/useSocket.ts
// import { useEffect, useRef, useCallback } from 'react';
// import { io, Socket } from 'socket.io-client';

// const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// export function useSocket() {
//   const socketRef = useRef<Socket | null>(null);

//   useEffect(() => {
//     const token = localStorage.getItem('accessToken');

//     socketRef.current = io(SOCKET_URL, {
//       transports: ['websocket'],
//       auth: { token }, // 👈 sent on connection — gateway reads it
//     });

//     socketRef.current.on('connect', () => {
//       console.log('Connected — joined personal room automatically');
//     });

//     socketRef.current.on('disconnect', () => {
//       console.log('Disconnected');
//     });

//     return () => {
//       socketRef.current?.disconnect();
//     };
//   }, []);

//   const on = useCallback(<T>(event: string, callback: (data: T) => void) => {
//     socketRef.current?.on(event, callback);
//     return () => {
//       socketRef.current?.off(event, callback);
//     };
//   }, []);

//   return { on };
// }

// // JOURNEY

// User logs in → receives JWT
//       ↓
// React connects socket with token in auth
//       ↓
// Gateway verifies JWT → extracts user.sub
//       ↓
// Socket joins room "user:abc123"
//       ↓
// Any service calls emitToUser('abc123', 'event', data)
//       ↓
// Only that user's connected clients receive it ✅

// import { useEffect, useState } from "react";
// import { io } from "socket.io-client";

// // Initialize socket connection (or import a shared global instance)
// const socket = io("https://yourstore.com", {
//   auth: { token: "USER_JWT_TOKEN" }
// });

// export default function Dashboard() {
//   const [notifications, setNotifications] = useState([]);
//   const [stockAlert, setStockAlert] = useState(null);

//   useEffect(() => {
//     // 📡 Channel 1: Listen for personal order status changes
//     socket.on("order_status_changed", (data) => {
//       console.log("Order Update Received:", data);
//       setNotifications((prev) => [...prev, `Order ${data.orderId} is now ${data.status}`]);
//     });

//     // 📡 Channel 2: Listen for specific item price drops
//     socket.on("wishlist_price_drop", (data) => {
//       alert(`Good news! ${data.itemName} dropped to $${data.newPrice}!`);
//     });

//     // 📡 Channel 3: Listen for site-wide flash sales
//     socket.on("flash_sale_start", (data) => {
//       setStockAlert(`Flash Sale Live! Use code ${data.code} for ${data.discountPercent}% off!`);
//     });

//     // 🛑 CRITICAL: Clean up listeners when the component unmounts
//     return () => {
//       socket.off("order_status_changed");
//       socket.off("wishlist_price_drop");
//       socket.off("flash_sale_start");
//     };
//   }, []); // Empty dependency array ensures this runs once on mount

//   return (
//     <div>
//       {stockAlert && <div className="banner">{stockAlert}</div>}
//       <h1>Your E-commerce Dashboard</h1>
//       {/* Render notifications here */}
//     </div>
//   );
// }
