import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Client } from 'src/clients/entities/client.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { Menu } from 'src/menus/entities/menu.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { EnumOrderCancelledReason } from 'src/common/enums/order-cancelled-reason';

export type OrderDocument = HydratedDocument<Order>;

export class OrderItem {
  product: Types.ObjectId | Menu;
  quantity: number;
  originalPrice: number;
}

export class Pricing {
  totalAmountCollected: number;
  restaurantAmount: number;
  deliveryFeeAmount: number;
}

export class MetaData {
  platformPercentage: number;
  collectionPercentage: number;
  disbursementPercentage: number;
}

@Schema({ timestamps: true })
export class Order extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Client.name, required: true })
  client: Types.ObjectId | Client;

  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ enum: EnumOrderStatus, type: String, required: true })
  status: EnumOrderStatus;

  @Prop({
    type: [
      {
        product: { type: Types.ObjectId, ref: Menu.name, required: true },
        quantity: { type: Number, required: true, min: 1 },
        originalPrice: { type: Number, required: true },
        _id: false,
      },
    ],
    required: true,
  })
  items: OrderItem[];

  @Prop({ enum: EnumOrderCancelledReason, type: String, required: false })
  orderCancelReason: EnumOrderCancelledReason;

  @Prop({ type: Date, default: null })
  maxTimeToPayOrder: Date | null;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
