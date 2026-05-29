import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EnumUserRole } from '../../common/enums/user-roles';
import { BaseSchema } from '../../common/schemas/base.schema';
import { EnumAuthType } from 'src/common/enums/auth-types';

export type UserDocument = HydratedDocument<User> & {
  // parsePublic(): void;
};

@Schema({ timestamps: true })
export class User extends BaseSchema {
  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ unique: true })
  email: string;

  @Prop()
  password: string;

  @Prop({ enum: EnumUserRole, type: String })
  role: EnumUserRole;

  @Prop({ index: true })
  token: string;

  @Prop({ enum: EnumAuthType, type: String })
  authType: EnumAuthType;

  @Prop({ type: Boolean, default: true })
  active: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// UserSchema.methods.parsePublic = function () {
//   const obj = this.toObject();

//   obj.id = obj._id;
//   delete obj._id;
//   delete obj.__v;
//   delete obj.deletedAt;

//   return obj;
// };
