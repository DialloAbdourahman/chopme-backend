import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';

export class CreateRestaurantMemberDto {
  @IsString()
  fullName: string;

  @IsString()
  @IsEmail(undefined, {
    message: 'Enter a valid email address',
  })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  password: string;

  @IsEnum(EnumRestaurantMemberRole)
  role: EnumRestaurantMemberRole;
}
