import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';

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
  totalPayoutAmount: number;

  @Prop({ type: [Types.ObjectId], ref: 'Transfer' })
  transfers: Types.ObjectId[];
}

export const TransferGroupSchema = SchemaFactory.createForClass(TransferGroup);
