import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Client } from 'src/clients/entities/client.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';

export type RestaurantRatingDocument = HydratedDocument<RestaurantRating>;

@Schema({ timestamps: true })
export class RestaurantRating extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Client.name, required: true })
  client: Types.ObjectId | Client;

  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, required: true })
  comment: string;

  @Prop({
    required: true,
  })
  publicUserName: string;
}

export const RestaurantRatingSchema =
  SchemaFactory.createForClass(RestaurantRating);
