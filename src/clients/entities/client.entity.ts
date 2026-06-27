import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from '../../common/schemas/base.schema';
import { User } from '../../users/entities/user.entity';

export type ClientDocument = HydratedDocument<Client>;

@Schema({ timestamps: true })
export class Client extends BaseSchema {
  @Prop({ required: false })
  customer_id: string;

  @Prop({ required: false })
  phone_number: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId | User;

  @Prop({
    type: {
      longitude: { type: Number, required: true },
      latitude: { type: Number, required: true },
    },
    _id: false,
    required: false,
  })
  address?: {
    longitude: number;
    latitude: number;
  };

  @Prop({
    type: [
      {
        paymentMethodId: {
          type: String,
          required: true,
        },
        prefix: {
          type: String,
          default: '237',
          required: true,
        },
        accountNumber: {
          type: String,
          required: true,
        },
        _id: false,
      },
    ],
    default: [],
  })
  paymentMethods: {
    paymentMethodId: String;
    prefix: string;
    accountNumber: Date;
  }[];
}

export const ClientSchema = SchemaFactory.createForClass(Client);
