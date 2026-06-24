import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';
import { Restaurant, RestaurantSchema } from './entities/restaurant.entity';
import {
  RestaurantMember,
  RestaurantMemberSchema,
} from 'src/restaurant-members/entities/restaurant-member.entity';
import { User, UserSchema } from 'src/users/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: RestaurantMember.name, schema: RestaurantMemberSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
})
export class RestaurantsModule {}
