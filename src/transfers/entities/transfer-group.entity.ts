import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { EnumTranzakTopupStatus } from 'src/common/enums/tranzak/topup-status';
import {
  TransferWebhookDetails,
  TransferWebhookDetailsSchema,
} from './transfer.entity';

@Schema({ _id: false })
export class TopupDetails {
  @Prop({ type: String, required: false })
  transferId?: string;

  @Prop({ type: String, required: false })
  status?: EnumTranzakTopupStatus;

  @Prop({ type: String, required: false })
  payeeAccountId?: string;

  @Prop({ type: String, required: false })
  fundingAccountId?: string;

  @Prop({ type: String, required: false })
  payeeAccountName?: string | null;

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

  @Prop({ type: Boolean, required: false })
  feeIsPaidByPayee?: boolean;

  @Prop({ type: String, required: false })
  createdByAppId?: string;

  @Prop({ type: String, required: false })
  payoutId?: string | null;

  @Prop({ type: Number, required: false })
  payeeFeePercentage?: number | null;

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

  @Prop({ type: String, required: false })
  sms?: string | null;

  @Prop({ type: Boolean, required: false })
  verifyPayeeName?: boolean;

  @Prop({ type: String, required: false })
  createdAt?: string;

  @Prop({ type: Boolean, required: false })
  sendSmsToPayee?: boolean;

  @Prop({ type: String, required: false })
  smsContent?: string;

  @Prop({ type: String, required: false })
  smsMobileNumber?: string;

  @Prop({ type: Boolean, required: false })
  payeeSmsSuccess?: boolean;

  @Prop({ type: String, required: false })
  errorMessage?: string;
}

export const TopupDetailsSchema = SchemaFactory.createForClass(TopupDetails);

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

  @Prop({ type: String, required: true, unique: true })
  currentTranzactionRef: string;

  @Prop({ type: [String], required: true })
  tranzactionRefs: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Transfer' })
  transfers: Types.ObjectId[];

  @Prop({
    enum: EnumTranzakTopupStatus,
    type: String,
    required: false,
  })
  topupStatus?: EnumTranzakTopupStatus;

  @Prop({ type: TopupDetailsSchema, required: false })
  topupDetails?: TopupDetails;

  @Prop({ type: TransferWebhookDetailsSchema, required: false })
  topupWebhookDetails?: TransferWebhookDetails;
}

export const TransferGroupSchema = SchemaFactory.createForClass(TransferGroup);
