import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AvailabilityDto,
  DeliveryPricingKmDto,
  RestaurantAddressDto,
  RestaurantLocationDto,
} from './create-restaurant.dto';
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  slogan?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  restaurantEmail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pictures?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryPricingKmDto)
  deliveryPricingKm?: DeliveryPricingKmDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto[];
}

export class AdminUpdateRestaurantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(EnumRestaurantType)
  type?: EnumRestaurantType;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestaurantAddressDto)
  address?: RestaurantAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestaurantLocationDto)
  location?: RestaurantLocationDto;
}
