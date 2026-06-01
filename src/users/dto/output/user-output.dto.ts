import { Expose } from 'class-transformer';
import { EnumUserRole } from 'src/common/enums/user-roles';

export class UserPublicOutputDto {
  @Expose()
  id: string;

  @Expose()
  fullName: string;

  @Expose()
  email: string;

  @Expose()
  role: EnumUserRole;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class UserPrivateOutputDto extends UserPublicOutputDto {
  @Expose()
  deletedAt: Date | null;
}
