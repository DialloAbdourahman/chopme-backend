import { Module } from '@nestjs/common';
import { TranzakWebhookService } from './tranzak-webhook.service';
import { TranzakWebhookController } from './tranzak-webhook.controller';
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
import {
  TransferGroup,
  TransferGroupSchema,
} from 'src/transfers/entities/transfer-group.entity';
import {
  Transfer,
  TransferSchema,
} from 'src/transfers/entities/transfer.entity';
import { User, UserSchema } from 'src/users/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Menu.name, schema: MenuSchema },
      { name: RestaurantMember.name, schema: RestaurantMemberSchema },
      { name: FcmToken.name, schema: FcmTokenSchema },
      { name: TransferGroup.name, schema: TransferGroupSchema },
      { name: Transfer.name, schema: TransferSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WebSocketModule,
  ],
  controllers: [TranzakWebhookController],
  providers: [TranzakWebhookService],
})
export class TranzakWebhookModule {}
