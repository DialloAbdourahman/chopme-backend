import { Global, Module } from '@nestjs/common';
import { WebSocketService } from './web-socket-service';

@Global()
@Module({
  providers: [WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}

// npm install @socket.io/redis-adapter ioredis

// // redis-io.adapter.ts
// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { INestApplicationContext } from '@nestjs/common';
// import { ServerOptions } from 'socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import Redis from 'ioredis';

// export class RedisIoAdapter extends IoAdapter {
//   private adapterConstructor: ReturnType<typeof createAdapter>;

//   constructor(app: INestApplicationContext) {
//     super(app);
//   }

//   async connectToRedis(): Promise<void> {
//     const pubClient = new Redis(process.env.REDIS_PUBSUB_URL); // dedicated pub/sub Redis
//     const subClient = pubClient.duplicate();

//     this.adapterConstructor = createAdapter(pubClient, subClient);
//   }

//   createIOServer(port: number, options?: ServerOptions) {
//     const server = super.createIOServer(port, options);
//     server.adapter(this.adapterConstructor);
//     return server;
//   }
// }

// // main.ts
// const app = await NestFactory.create(AppModule);

// const redisIoAdapter = new RedisIoAdapter(app);
// await redisIoAdapter.connectToRedis();
// app.useWebSocketAdapter(redisIoAdapter);

// await app.listen(3000);
