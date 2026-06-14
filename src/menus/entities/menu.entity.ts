import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EnumMenuCategory } from 'src/common/enums/menu-category';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';

export type MenuDocument = HydratedDocument<Menu>;

@Schema({ timestamps: true })
export class Menu extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: EnumMenuCategory, type: String })
  category: EnumMenuCategory;

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

  @Prop({
    type: {
      average: { type: Number },
      total: { type: Number },
    },
    _id: false,
    default: {
      average: 0,
      total: 0,
    },
  })
  rating: {
    average: number;
    total: number;
  };

  @Prop({ default: 0 })
  totalViews: number;

  @Prop({ default: 0 })
  ordersCount: number;
}

export const MenuSchema = SchemaFactory.createForClass(Menu);
