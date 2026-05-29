import { Prop } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export abstract class BaseSchema {
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  createdBy: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  updatedBy: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
  })
  deletedBy: Types.ObjectId | null;
}
