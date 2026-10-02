import { IsString, IsEmail, IsEnum } from 'class-validator';
import { EnumUserRole } from 'src/common/enums/user-roles';

export class EmailPasswordLoginDto {
  @IsString()
  @IsEmail(undefined, {
    message: 'Enter a valid email address',
  })
  email: string;

  @IsString()
  password: string;

  @IsEnum(EnumUserRole)
  role: EnumUserRole;
}
