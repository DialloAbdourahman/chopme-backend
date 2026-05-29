import { IsString, IsEmail } from 'class-validator';

export class EmailPasswordLoginDto {
  @IsString()
  @IsEmail(undefined, {
    message: 'Enter a valid email address',
  })
  email: string;

  @IsString()
  password: string;
}
