import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { EnumRefundStatus } from 'src/common/enums/refund-statuses';
import type { Order } from './order.entity';
import type { Restaurant } from 'src/restaurants/entities/restaurant.entity';

export type RefundDocument = HydratedDocument<Refund>;

export class RefundDetails {
  refundId?: string;
  refundedTransactionId?: string;
  amount?: number;
  currencyCode?: string;
  status?: string;
  merchantRefundRef?: string;
  note?: string;
  reasonCode?: string;
  createdAt?: string;
  approvedAt?: string;
}

export class RefundWebhookDetails {
  webhookId?: string;
  refundId?: string;
  refundedTransactionId?: string;
  amount?: number;
  currencyCode?: string;
  status?: string;
  merchantRefundRef?: string;
  note?: string;
  reasonCode?: number;
  reason?: string;
  createdAt?: string;
  approvedAt?: string;
}

@Schema({ timestamps: true })
export class Refund extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  order: Types.ObjectId | Order;

  @Prop({
    type: Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true,
  })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({ type: String, required: false, index: true })
  transactionId?: string;

  @Prop({
    enum: EnumRefundStatus,
    type: String,
    required: true,
    default: EnumRefundStatus.CREATED,
  })
  status: EnumRefundStatus;

  @Prop({
    type: {
      refundId: { type: String, required: false },
      refundedTransactionId: { type: String, required: false },
      amount: { type: Number, required: false },
      currencyCode: { type: String, required: false },
      status: { type: String, required: false },
      merchantRefundRef: { type: String, required: false },
      note: { type: String, required: false },
      reasonCode: { type: String, required: false },
      createdAt: { type: String, required: false },
      approvedAt: { type: String, required: false },
    },
    _id: false,
    required: false,
  })
  refundDetails: RefundDetails;

  @Prop({
    type: {
      webhookId: { type: String, required: false },
      refundId: { type: String, required: false },
      refundedTransactionId: { type: String, required: false },
      amount: { type: Number, required: false },
      currencyCode: { type: String, required: false },
      status: { type: String, required: false },
      merchantRefundRef: { type: String, required: false },
      note: { type: String, required: false },
      reasonCode: { type: Number, required: false },
      reason: { type: String, required: false },
      createdAt: { type: String, required: false },
      approvedAt: { type: String, required: false },
    },
    _id: false,
    required: false,
  })
  refundWebhookDetails: RefundWebhookDetails;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
