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
import { EnumCities } from 'src/common/enums/cities';
import { EnumCountries } from 'src/common/enums/countries';

export class RestaurantAddressDto {
  @IsEnum(EnumCountries)
  country: EnumCountries;

  @IsEnum(EnumCities)
  city: EnumCities;

  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;
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
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  restaurantEmail?: string;

  @ValidateNested()
  @Type(() => RestaurantAddressDto)
  address: RestaurantAddressDto;

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
