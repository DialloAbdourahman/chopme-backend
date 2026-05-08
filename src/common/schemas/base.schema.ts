import { Prop } from '@nestjs/mongoose';

export abstract class BaseSchema {
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}
