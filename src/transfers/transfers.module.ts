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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transfer.name, schema: TransferSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
