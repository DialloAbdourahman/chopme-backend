import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { EnumUserLanguage } from 'src/common/enums/user-language';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Full name must be at least 5 characters long' })
  fullName?: string;

  @IsOptional()
  @IsEnum(EnumUserLanguage)
  language?: EnumUserLanguage;
}
