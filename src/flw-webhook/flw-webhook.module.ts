import { Module } from '@nestjs/common';
import { FlwWebhookService } from './flw-webhook.service';
import { FlwWebhookController } from './flw-webhook.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Menu, MenuSchema } from 'src/menus/entities/menu.entity';
import { Order, OrderSchema } from 'src/orders/entities/order.entity';
import { WebSocketModule } from 'src/web-socket/web-socket.module';
import {
  RestaurantMember,
  RestaurantMemberSchema,
} from 'src/restaurant-members/entities/restaurant-member.entity';
import {
  FcmToken,
  FcmTokenSchema,
} from 'src/fcm-tokens/entities/fcm-token.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Menu.name, schema: MenuSchema },
      { name: RestaurantMember.name, schema: RestaurantMemberSchema },
      { name: FcmToken.name, schema: FcmTokenSchema },
    ]),
    WebSocketModule,
  ],
  controllers: [FlwWebhookController],
  providers: [FlwWebhookService],
})
export class FlwWebhookModule {}
