import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { EnumTranzakTopupStatus } from 'src/common/enums/tranzak/topup-status';

export class TopupDetails {
  transferId?: string;
  status?: EnumTranzakTopupStatus;
  payeeAccountId?: string;
  fundingAccountId?: string;
  payeeAccountName?: string | null;
  destinationServiceName?: string;
  payeeNote?: string;
  description?: string;
  amount?: number;
  currencyCode?: string;
  fee?: number;
  customTransactionRef?: string;
  feeIsPaidByPayee?: boolean;
  createdByAppId?: string;
  payoutId?: string | null;
  payeeFeePercentage?: number | null;
  type?: string;
  transactionId?: string;
  transactionTime?: string;
  partnerTransactionId?: string;
  sms?: string | null;
  verifyPayeeName?: boolean;
  createdAt?: string;
}

export class TopupWebhookDetails {
  transferId?: string;
  status?: EnumTranzakTopupStatus;
  payeeAccountId?: string;
  fundingAccountId?: string;
  payeeAccountName?: string | null;
  destinationServiceName?: string;
  payeeNote?: string;
  description?: string;
  amount?: number;
  currencyCode?: string;
  fee?: number;
  customTransactionRef?: string;
  feeIsPaidByPayee?: boolean;
  createdByAppId?: string;
  payoutId?: string | null;
  payeeFeePercentage?: number | null;
  type?: string;
  transactionId?: string;
  transactionTime?: string;
  partnerTransactionId?: string;
  sms?: string | null;
  verifyPayeeName?: boolean;
  createdAt?: string;
}

export type TransferGroupDocument = HydratedDocument<TransferGroup>;

@Schema({ timestamps: true })
export class TransferGroup extends BaseSchema {
  @Prop({ type: Number, required: true })
  restaurantAmount: number;

  @Prop({ type: Number, required: true })
  platformAmount: number;

  @Prop({ type: Number, required: true })
  totalAmount: number;

  @Prop({ type: Number, required: true })
  totalTopupAmount: number;

  @Prop({ type: [Types.ObjectId], ref: 'Transfer' })
  transfers: Types.ObjectId[];

  @Prop({
    enum: EnumTranzakTopupStatus,
    type: String,
    required: false,
  })
  topupStatus?: EnumTranzakTopupStatus;

  @Prop({ type: TopupDetails })
  topupDetails?: TopupDetails;

  @Prop({ type: TopupWebhookDetails })
  topupWebhookDetails?: TopupWebhookDetails;
}

export const TransferGroupSchema = SchemaFactory.createForClass(TransferGroup);
