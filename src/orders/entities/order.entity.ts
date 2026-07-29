import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Client } from 'src/clients/entities/client.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { Menu } from 'src/menus/entities/menu.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { EnumOrderCancelledReason } from 'src/common/enums/order-cancelled-reason';
import { EnumRefundStatus } from 'src/common/enums/refund-statuses';
import { RestaurantMember } from 'src/restaurant-members/entities/restaurant-member.entity';
import { Transfer } from 'src/transfers/entities/transfer.entity';

export type OrderDocument = HydratedDocument<Order>;

export class OrderItem {
  product: Types.ObjectId | Menu;
  quantity: number;
  originalPrice: number;
  priceWithPlatformPercentage: number;
}

export class Pricing {
  // Total amount collected for products with platform percentage
  totalAmountCollected: number;
  // Total amount collected for products with platform percentage and delivery fee (with delivery fee's collection and disbursement percentages)
  totalAmountCollectedWithDelivery: number;
  // Total amount that restaurant will receive without delivery fees
  restaurantAmount: number;
  // Total amount that restaurant will receive with delivery fees
  restaurantAmountWithDelivery: number;
  // Original delivery fee amount based on distance
  deliveryFeeAmount: number;
  // Delivery fee amount with collection and disbursement percentages applied
  deliveryFeeAmountWithCollectionAndDisbursementPercentage: number;
  // Amount that platform earns (platform percentage - collection percentage - disbursement percentage)
  platformEarningsAmount: number;
}

export class MetaData {
  platformPercentage: number;
  collectionPercentage: number;
  disbursementPercentage: number;
}

export class PaymentDetails {
  link: string;
  validUntil: Date;
}

export class PaymentWebhookDetails {
  transactionId?: number;
  amount?: number;
  appFee?: number;
  chargedAmount?: number;
  currency?: string;
  ip?: string;
  merchantFee?: number;
  paymentType?: string;
  status?: string;
  txRef?: string;
  flwRef?: string;
}

export class RefundWebhookDetails {
  id?: number;
}

@Schema({ timestamps: true })
export class Order extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Client.name, required: true })
  client: Types.ObjectId | Client;

  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ type: Types.ObjectId, ref: RestaurantMember.name, required: false })
  cancelledByRestaurantMember?: Types.ObjectId | RestaurantMember;

  @Prop({ type: Types.ObjectId, ref: Transfer.name, required: false })
  transfer?: Types.ObjectId | Transfer;

  @Prop({
    enum: EnumOrderStatus,
    type: String,
    required: true,
    default: EnumOrderStatus.CREATED,
  })
  status: EnumOrderStatus;

  @Prop({
    enum: EnumRefundStatus,
    type: String,
    required: false,
  })
  refundStatus?: EnumRefundStatus;

  @Prop({
    type: [
      {
        status: {
          enum: EnumOrderStatus,
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          required: true,
          default: Date.now,
        },
        _id: false,
      },
    ],
    default: [],
  })
  statusTransitions: {
    status: EnumOrderStatus;
    timestamp: Date;
  }[];

  @Prop({
    type: [
      {
        product: { type: Types.ObjectId, ref: Menu.name, required: true },
        quantity: { type: Number, required: true, min: 1 },
        originalPrice: { type: Number, required: true },
        priceWithPlatformPercentage: { type: Number, required: true },
        _id: false,
      },
    ],
    required: true,
  })
  items: OrderItem[];

  @Prop({ enum: EnumOrderCancelledReason, type: String, required: false })
  orderCancelReason: EnumOrderCancelledReason;

  @Prop({
    type: {
      totalAmountCollected: { type: Number, required: true },
      totalAmountCollectedWithDelivery: { type: Number, required: true },
      restaurantAmount: { type: Number, required: true },
      restaurantAmountWithDelivery: { type: Number, required: true },
      deliveryFeeAmount: { type: Number, required: true },
      deliveryFeeAmountWithCollectionAndDisbursementPercentage: {
        type: Number,
        required: true,
      },
      platformEarningsAmount: { type: Number, required: true },
    },
    _id: false,
    required: true,
  })
  pricing: Pricing;

  @Prop({
    type: {
      platformPercentage: { type: Number, required: true },
      collectionPercentage: { type: Number, required: true },
      disbursementPercentage: { type: Number, required: true },
    },
    _id: false,
    required: true,
  })
  metaData: MetaData;

  @Prop({ type: Date, default: null })
  maxTimeToPayOrder: Date | null;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  @Prop({ type: Date, default: null })
  failedPaymentAt: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({
    type: {
      link: {
        type: String,
        required: true,
      },
      validUntil: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    _id: false,
    required: false,
  })
  paymentDetails: PaymentDetails;

  @Prop({
    type: {
      transactionId: { type: Number, required: false },
      amount: { type: Number, required: false },
      appFee: { type: Number, required: false },
      chargedAmount: { type: Number, required: false },
      currency: { type: String, required: false },
      ip: { type: String, required: false },
      merchantFee: { type: Number, required: false },
      paymentType: { type: String, required: false },
      status: { type: String, required: false },
      txRef: { type: String, required: false },
      flwRef: { type: String, required: false },
    },
    _id: false,
    required: false,
  })
  paymentWebhookDetails: PaymentWebhookDetails;

  @Prop({
    type: {
      id: { type: Number, required: false },
    },
    _id: false,
    required: false,
  })
  refundWebhookDetails: RefundWebhookDetails;

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
  clientLocation: {
    type: string;
    coordinates: number[];
  };

  @Prop({ type: Number, required: true })
  distanceKm: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
