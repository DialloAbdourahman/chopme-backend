import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './entities/order.entity';
import { Menu, MenuSchema } from 'src/menus/entities/menu.entity';
import { Client } from 'src/clients/entities/client.entity';
import {
  Restaurant,
  RestaurantSchema,
} from 'src/restaurants/entities/restaurant.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Menu.name, schema: MenuSchema },
      { name: Client.name, schema: MenuSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
