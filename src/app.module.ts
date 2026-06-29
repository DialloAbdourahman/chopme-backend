import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { LoggerModule } from './common/logger/logger.module';
import { GlobalJwtModule } from './common/modules/jwt.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ClientsModule } from './clients/clients.module';
import { env } from './config/env';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenusModule } from './menus/menus.module';
import { OrdersModule } from './orders/orders.module';
import { RestaurantMembersModule } from './restaurant-members/restaurant-members.module';
import { CategoriesModule } from './categories/categories.module';
import { WebSocketModule } from './web-socket/web-socket.module';
import { WebSocketService } from './web-socket/web-socket-service';
import { FlutterwaveModule } from './common/flutterwave/flutterwave.module';
import { FlwWebhookModule } from './flw-webhook/flw-webhook.module';

@Module({
  imports: [
    LoggerModule,
    GlobalJwtModule,
    UsersModule,
    MongooseModule.forRoot(env.mongodbUri),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    ClientsModule,
    RestaurantsModule,
    MenusModule,
    OrdersModule,
    RestaurantMembersModule,
    CategoriesModule,
    WebSocketModule,
    FlutterwaveModule.forRoot({
      baseUrl: env.flutterWaveUrl,
      secretKey: env.flutterWaveClientSecretKey,
    }),
    FlwWebhookModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    WebSocketService,
  ],
})
export class AppModule {}
