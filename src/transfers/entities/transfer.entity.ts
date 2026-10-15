import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';
import { EnumTransferDirection } from 'src/common/enums/transfer-direction';
import { TransferGroup } from './transfer-group.entity';

export type TransferDocument = HydratedDocument<Transfer>;

export class TransferWebhookDetails {
  transferId?: string;
  status?: string;
  payeeAccountId?: string;
  fundingAccountId?: string;
  payeeAccountName?: string;
  destinationServiceName?: string;
  payeeNote?: string;
  description?: string;
  amount?: number;
  currencyCode?: string;
  fee?: number;
  customTransactionRef?: string;
  createdByAppId?: string;
  type?: string;
  transactionId?: string;
  transactionTime?: string;
  partnerTransactionId?: string;
  sendSmsToPayee?: boolean;
  smsContent?: string;
  smsMobileNumber?: string;
  payeeSmsSuccess?: boolean;
  createdAt?: string;
  errorMessage?: string;
  refundId?: string;
}

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
    ref: TransferGroup.name,
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

  @Prop({
    type: {
      transferId: { type: String, required: false },
      status: { type: String, required: false },
      payeeAccountId: { type: String, required: false },
      fundingAccountId: { type: String, required: false },
      payeeAccountName: { type: String, required: false },
      destinationServiceName: { type: String, required: false },
      payeeNote: { type: String, required: false },
      description: { type: String, required: false },
      amount: { type: Number, required: false },
      currencyCode: { type: String, required: false },
      fee: { type: Number, required: false },
      customTransactionRef: { type: String, required: false },
      createdByAppId: { type: String, required: false },
      type: { type: String, required: false },
      transactionId: { type: String, required: false },
      transactionTime: { type: String, required: false },
      partnerTransactionId: { type: String, required: false },
      sendSmsToPayee: { type: Boolean, required: false },
      smsContent: { type: String, required: false },
      smsMobileNumber: { type: String, required: false },
      payeeSmsSuccess: { type: Boolean, required: false },
      createdAt: { type: String, required: false },
      errorMessage: { type: String, required: false },
      refundId: { type: String, required: false },
    },
    _id: false,
  })
  transferWebhookDetails?: TransferWebhookDetails;
}

export const TransferSchema = SchemaFactory.createForClass(Transfer);
