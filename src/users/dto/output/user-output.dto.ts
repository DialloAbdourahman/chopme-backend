import { Expose } from 'class-transformer';
import { EnumUserRole } from 'src/common/enums/user-roles';

export class UserPublicOutputDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  role: EnumUserRole;
}

export class UserPrivateOutputDto extends UserPublicOutputDto {
  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
