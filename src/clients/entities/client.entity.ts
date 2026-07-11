import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from '../../common/schemas/base.schema';
import { User } from '../../users/entities/user.entity';

export type ClientDocument = HydratedDocument<Client>;

@Schema({ timestamps: true })
export class Client extends BaseSchema {
  @Prop({ required: false })
  phoneNumber: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId | User;

  @Prop({
    type: {
      longitude: { type: Number, required: true },
      latitude: { type: Number, required: true },
      country: { type: String, required: false },
      city: { type: String, required: false },
    },
    _id: false,
    required: false,
  })
  address?: {
    longitude: number;
    latitude: number;
    country: string;
    city: string;
  };
}

export const ClientSchema = SchemaFactory.createForClass(Client);
