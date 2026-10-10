import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsIn,
  IsString,
  IsDate,
} from 'class-validator';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumAuthType } from 'src/common/enums/auth-types';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsEnum(EnumUserRole)
  role?: EnumUserRole;

  @IsOptional()
  @IsEnum(EnumAuthType)
  authType?: EnumAuthType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  dateFrom?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  @IsDate()
  dateTo?: Date;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['createdAt', 'lastLoginAt', 'lastTokenRefreshedAt'])
  sortBy?: 'createdAt' | 'lastLoginAt' | 'lastTokenRefreshedAt';

  @IsOptional()
  @IsString()
  search?: string;
}
