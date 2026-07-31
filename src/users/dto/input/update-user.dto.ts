import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Full name must be at least 5 characters long' })
  fullName?: string;
}
