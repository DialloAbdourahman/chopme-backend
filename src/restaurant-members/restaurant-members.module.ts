import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RestaurantMembersService } from './restaurant-members.service';
import { RestaurantMembersController } from './restaurant-members.controller';
import {
  RestaurantMember,
  RestaurantMemberSchema,
} from './entities/restaurant-member.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RestaurantMember.name,
        schema: RestaurantMemberSchema,
      },
    ]),
    JwtModule.register({}),
  ],
  controllers: [RestaurantMembersController],
  providers: [RestaurantMembersService],
})
export class RestaurantMembersModule {}
