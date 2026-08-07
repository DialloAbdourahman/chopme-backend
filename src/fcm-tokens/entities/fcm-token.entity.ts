import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from '../../common/schemas/base.schema';
import { User } from '../../users/entities/user.entity';

export type FcmTokenDocument = HydratedDocument<FcmToken>;

@Schema({ timestamps: true })
export class FcmToken extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId | User;

  @Prop({ required: true, trim: true })
  installationId: string;
}

export const FcmTokenSchema = SchemaFactory.createForClass(FcmToken);

FcmTokenSchema.index({ user: 1, installationId: 1 }, { unique: true });
