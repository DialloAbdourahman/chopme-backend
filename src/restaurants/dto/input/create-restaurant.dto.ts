import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';

export class RestaurantAddressDto {
  @IsString()
  country: string;

  @IsString()
  city: string;

  @IsString()
  @IsOptional()
  longName: string;

  @IsString()
  countryCode: string;

  @IsString()
  @IsOptional()
  state: string;
}

export class RestaurantLocationDto {
  @IsString()
  @IsEnum(['Point'])
  type: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: number[];
}

export class DeliveryPricingKmDto {
  @IsNumber()
  from: number;

  @IsNumber()
  to: number;

  @IsNumber()
  price: number;
}

export class AvailabilityDto {
  @IsString()
  day: string;

  @IsString()
  openTime: string;

  @IsString()
  closeTime: string;
}

export class CreateRestaurantDto {
  // Owner user fields
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

  // Restaurant fields
  @IsString()
  name: string;

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

  @IsEnum(EnumRestaurantType)
  type: EnumRestaurantType;

  @ValidateNested()
  @Type(() => RestaurantAddressDto)
  address: RestaurantAddressDto;

  @ValidateNested()
  @Type(() => RestaurantLocationDto)
  location: RestaurantLocationDto;

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
