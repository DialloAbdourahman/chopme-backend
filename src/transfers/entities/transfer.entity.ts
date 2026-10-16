import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';
import { EnumTransferDirection } from 'src/common/enums/transfer-direction';
import { TransferGroup } from './transfer-group.entity';

export type TransferDocument = HydratedDocument<Transfer>;

@Schema({ _id: false })
export class TransferWebhookDetails {
  @Prop({ type: String, required: false })
  transferId?: string;

  @Prop({ type: String, required: false })
  status?: string;

  @Prop({ type: String, required: false })
  payeeAccountId?: string;

  @Prop({ type: String, required: false })
  fundingAccountId?: string;

  @Prop({ type: String, required: false })
  payeeAccountName?: string;

  @Prop({ type: String, required: false })
  destinationServiceName?: string;

  @Prop({ type: String, required: false })
  payeeNote?: string;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: Number, required: false })
  amount?: number;

  @Prop({ type: String, required: false })
  currencyCode?: string;

  @Prop({ type: Number, required: false })
  fee?: number;

  @Prop({ type: String, required: false })
  customTransactionRef?: string;

  @Prop({ type: String, required: false })
  createdByAppId?: string;

  // Field name `type` must be declared as a schema type property to avoid
  // Mongoose treating it as a nested object definition.
  @Prop({ type: String, required: false })
  type?: string;

  @Prop({ type: String, required: false })
  transactionId?: string;

  @Prop({ type: String, required: false })
  transactionTime?: string;

  @Prop({ type: String, required: false })
  partnerTransactionId?: string;

  @Prop({ type: Boolean, required: false })
  sendSmsToPayee?: boolean;

  @Prop({ type: String, required: false })
  smsContent?: string;

  @Prop({ type: String, required: false })
  smsMobileNumber?: string;

  @Prop({ type: Boolean, required: false })
  payeeSmsSuccess?: boolean;

  @Prop({ type: String, required: false })
  createdAt?: string;

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop({ type: String, required: false })
  refundId?: string;
}

export const TransferWebhookDetailsSchema = SchemaFactory.createForClass(
  TransferWebhookDetails,
);

@Schema({ timestamps: true })
export class Transfer extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: Restaurant.name, required: true })
  restaurant: Types.ObjectId | Restaurant;

  @Prop({
    enum: EnumTransferStatuses,
    type: String,
    required: true,
    default: EnumTransferStatuses.CREATED,
  })
  status: EnumTransferStatuses;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Number, required: true })
  totalOrders: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'TransferGroup',
    required: true,
    index: true,
  })
  transferGroup: Types.ObjectId | TransferGroup;

  @Prop({
    enum: EnumTransferDirection,
    type: String,
    required: true,
  })
  transferDirection: EnumTransferDirection;

  @Prop({ type: String, required: false })
  transferId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Transfer', required: false })
  retriedFromTransferId?: Types.ObjectId | Transfer;

  @Prop({ type: TransferWebhookDetailsSchema, required: false })
  transferWebhookDetails?: TransferWebhookDetails;
}

export const TransferSchema = SchemaFactory.createForClass(Transfer);
