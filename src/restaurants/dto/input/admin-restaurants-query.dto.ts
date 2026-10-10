import { IsString, IsBoolean, IsOptional, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';

export class AdminRestaurantsQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(EnumRestaurantType)
  @IsOptional()
  type?: EnumRestaurantType;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  deleted?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isClosed?: boolean;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
