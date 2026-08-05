import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AvailabilityDto,
  DeliveryPricingKmArrayValidator,
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
  @Matches(/^\+2376\d{8}$/, {
    message:
      'Phone number must be a valid Cameroonian number in the format +237620487789',
  })
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
  @Validate(DeliveryPricingKmArrayValidator)
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
