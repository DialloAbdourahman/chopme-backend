import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/common/schemas/base.schema';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';

export type TransferDocument = HydratedDocument<Transfer>;

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
  totalRestaurantAmount: number;

  @Prop({ type: Number, required: true })
  totalPlatformAmount: number;

  @Prop({ type: Number, required: true })
  totalOrders: number;

  @Prop({ type: Number, required: false })
  transferId: number;

  @Prop({
    enum: EnumTransferStatuses,
    type: String,
    required: false,
  })
  platformTransferStatus?: EnumTransferStatuses;

  @Prop({
    enum: EnumTransferStatuses,
    type: String,
    required: false,
  })
  restaurantTransferStatus?: EnumTransferStatuses;
}

export const TransferSchema = SchemaFactory.createForClass(Transfer);
