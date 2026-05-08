import { EnumUserRole } from '../../common/enums/user.roles';
import { IsString, IsEnum, IsEmail, Length } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'Name must be a string' })
  @Length(10, 20, { message: 'Name must be between 10 to 20 characters' })
  name: string;

  @IsString()
  @IsEmail(undefined, {
    message: 'Enter a valid email address',
  })
  email: string;

  @IsEnum(EnumUserRole, { message: 'Enter a valid role' })
  role: EnumUserRole;
}
