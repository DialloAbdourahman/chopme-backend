import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RestaurantRatingsService } from './restaurant-ratings.service';
import { RestaurantRatingsController } from './restaurant-ratings.controller';
import {
  RestaurantRating,
  RestaurantRatingSchema,
} from './entities/restaurant-rating.entity';
import { Order, OrderSchema } from 'src/orders/entities/order.entity';
import {
  Restaurant,
  RestaurantSchema,
} from 'src/restaurants/entities/restaurant.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RestaurantRating.name, schema: RestaurantRatingSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [RestaurantRatingsController],
  providers: [RestaurantRatingsService],
})
export class RestaurantRatingsModule {}
