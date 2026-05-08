import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EnumUserRole } from '../../common/enums/user.roles';
import { BaseSchema } from '../../common/schemas/base.schema';

export type UserDocument = HydratedDocument<User> & {
  public(): any;
};

@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop()
  name: string;

  @Prop({ unique: true })
  email: string;

  @Prop({ enum: EnumUserRole, type: String })
  role: EnumUserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.methods.public = function () {
  const obj = this.toObject();

  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  delete obj.deletedAt;

  return obj;
};
