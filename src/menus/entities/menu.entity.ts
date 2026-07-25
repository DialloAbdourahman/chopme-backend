import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Category } from 'src/categories/entities/category.entity';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';

export type MenuDocument = HydratedDocument<Menu>;

@Schema({ timestamps: true })
export class Menu extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: Category.name, required: true })
  category: Types.ObjectId | Category;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  coverImage?: string;

  @Prop({ type: [String], default: [] })
  pictures: string[];

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ type: Boolean, default: true })
  available: boolean;

  // @Prop({
  //   type: {
  //     average: { type: Number },
  //     total: { type: Number },
  //   },
  //   _id: false,
  //   default: {
  //     average: 0,
  //     total: 0,
  //   },
  // })
  // rating: {
  //   average: number;
  //   total: number;
  // };

  @Prop({ default: 0 })
  ordersCount: number;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };
}

export const MenuSchema = SchemaFactory.createForClass(Menu);
