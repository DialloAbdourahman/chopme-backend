import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Transfer, TransferSchema } from './entities/transfer.entity';
import { Order, OrderSchema } from 'src/orders/entities/order.entity';
import {
  Restaurant,
  RestaurantSchema,
} from 'src/restaurants/entities/restaurant.entity';
import {
  TransferGroup,
  TransferGroupSchema,
} from './entities/transfer-group.entity';
import {
  RestaurantMember,
  RestaurantMemberSchema,
} from 'src/restaurant-members/entities/restaurant-member.entity';
import { User, UserSchema } from 'src/users/entities/user.entity';
import {
  FcmToken,
  FcmTokenSchema,
} from 'src/fcm-tokens/entities/fcm-token.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transfer.name, schema: TransferSchema },
      { name: TransferGroup.name, schema: TransferGroupSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: RestaurantMember.name, schema: RestaurantMemberSchema },
      { name: User.name, schema: UserSchema },
      { name: FcmToken.name, schema: FcmTokenSchema },
    ]),
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
