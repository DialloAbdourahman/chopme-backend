import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from 'src/users/entities/user.entity';
import { Client, ClientSchema } from 'src/clients/entities/client.entity';
import {
  RestaurantMember,
  RestaurantMemberSchema,
} from 'src/restaurants/entities/restaurant-member.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Client.name, schema: ClientSchema },
      { name: RestaurantMember.name, schema: RestaurantMemberSchema },
    ]),
    JwtModule.register({}),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
