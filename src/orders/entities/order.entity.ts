import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Client } from 'src/clients/entities/client.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { Menu } from 'src/menus/entities/menu.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { EnumOrderCancelledReason } from 'src/common/enums/order-cancelled-reason';
import { RestaurantMember } from 'src/restaurant-members/entities/restaurant-member.entity';
import { Transfer } from 'src/transfers/entities/transfer.entity';
import { TransferGroup } from 'src/transfers/entities/transfer-group.entity';
import { Refund } from './refund.entity';

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
  requestId: string;
  appId: string;
}

export class PaymentWebhookDetails {
  webhookId?: string;
  requestId?: string;
  transactionId?: string;
  partnerTransactionId?: string;
  mchTransactionRef?: string;
  transactionTime?: Date;
  amount?: number;
  currencyCode?: string;
  status?: string;
  transactionStatus?: string;
  mobileWalletNumber?: string;
  paymentMethod?: string;
  payerName?: string;
  payerFee?: number;
  netAmountPaid?: number;
  merchantFee?: number;
  netAmountReceived?: number;
  errorCode?: number;
  errorMessage?: string;
}

@Schema({ timestamps: true })
export class Order extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Client.name, required: true })
  client: Types.ObjectId | Client;

  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ type: Types.ObjectId, ref: RestaurantMember.name, required: false })
  cancelledByRestaurantMember?: Types.ObjectId | RestaurantMember;

  @Prop({
    type: Types.ObjectId,
    ref: TransferGroup.name,
    required: false,
    index: true,
  })
  transferGroup?: Types.ObjectId | TransferGroup;

  @Prop({
    enum: EnumOrderStatus,
    type: String,
    required: true,
    default: EnumOrderStatus.CREATED,
  })
  status: EnumOrderStatus;

  @Prop({ type: Types.ObjectId, ref: Refund.name, required: false })
  refund?: Types.ObjectId | Refund;

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
      requestId: {
        type: String,
        required: true,
      },
      appId: {
        type: String,
        required: true,
      },
    },
    _id: false,
    required: false,
  })
  paymentDetails: PaymentDetails;

  @Prop({
    type: {
      webhookId: { type: String, required: false },
      requestId: { type: String, required: false },
      transactionId: { type: String, required: false },
      partnerTransactionId: { type: String, required: false },
      mchTransactionRef: { type: String, required: false },
      transactionTime: { type: Date, required: false },
      amount: { type: Number, required: false },
      currencyCode: { type: String, required: false },
      status: { type: String, required: false },
      transactionStatus: { type: String, required: false },
      mobileWalletNumber: { type: String, required: false },
      paymentMethod: { type: String, required: false },
      payerName: { type: String, required: false },
      payerFee: { type: Number, required: false },
      netAmountPaid: { type: Number, required: false },
      merchantFee: { type: Number, required: false },
      netAmountReceived: { type: Number, required: false },
      errorCode: { type: Number, required: false },
      errorMessage: { type: String, required: false },
    },
    _id: false,
    required: false,
  })
  paymentWebhookDetails: PaymentWebhookDetails;

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
