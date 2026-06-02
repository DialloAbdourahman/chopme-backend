import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from '../../common/schemas/base.schema';
import { User } from '../../users/entities/user.entity';

export type ClientDocument = HydratedDocument<Client>;

@Schema({ timestamps: true })
export class Client extends BaseSchema {
  @Prop({ required: false })
  customer_id: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId | User;

  @Prop({
    type: {
      country: { type: String },
      city: { type: String },
      longitude: { type: Number },
      latitude: { type: Number },
    },
    _id: false,
  })
  address: {
    country: string;
    city: string;
    longitude: number;
    latitude: number;
  };
}

export const ClientSchema = SchemaFactory.createForClass(Client);
