import { Expose, Transform } from 'class-transformer';
import { EnumAuthType } from 'src/common/enums/auth-types';
import { EnumUserRole } from 'src/common/enums/user-roles';

export class UserPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  fullName: string;

  @Expose()
  email: string;

  @Expose()
  role: EnumUserRole;

  @Expose()
  authType: EnumAuthType;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class UserPrivateOutputDto extends UserPublicOutputDto {
  @Expose()
  deletedAt: Date | null;
}
