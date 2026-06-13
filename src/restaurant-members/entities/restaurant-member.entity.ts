import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { User } from 'src/users/entities/user.entity';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';

export type RestaurantMemberDocument = HydratedDocument<RestaurantMember>;

@Schema({ timestamps: true })
export class RestaurantMember extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId | User;

  @Prop({ enum: EnumRestaurantMemberRole, type: String, required: true })
  role: EnumRestaurantMemberRole;

  @Prop({ type: Boolean, default: false })
  isOwner: boolean;
}

export const RestaurantMemberSchema =
  SchemaFactory.createForClass(RestaurantMember);
