import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  AvailabilityDto,
  DeliveryPricingKmDto,
  // RestaurantAddressDto,
} from './create-restaurant.dto';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  name?: string;

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
