import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';

export class FindRestaurantDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  radiusKm?: number;

  @IsEnum(EnumRestaurantType)
  @IsOptional()
  type?: EnumRestaurantType;

  // @IsBoolean()
  // @IsOptional()
  // @Type(() => Boolean)
  // onlyOpened?: boolean;
}
