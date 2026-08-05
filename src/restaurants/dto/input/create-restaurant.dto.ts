import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
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
  @Min(0)
  from: number;

  @IsNumber()
  to: number;

  @IsNumber()
  @IsPositive()
  price: number;
}

@ValidatorConstraint({ name: 'DeliveryPricingKmArray', async: false })
export class DeliveryPricingKmArrayValidator implements ValidatorConstraintInterface {
  validate(tiers?: DeliveryPricingKmDto[]): boolean {
    if (!Array.isArray(tiers) || tiers.length === 0) return true;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (i === 0 && tier.from !== 0) return false;
      if (tier.from < 0) return false;
      if (tier.to <= tier.from) return false;
      if (tier.price <= 0) return false;
    }

    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const curr = tiers[i];
      if (curr.from < prev.to) return false;
      if (curr.from > prev.to) return false;
      if (curr.price <= prev.price) return false;
    }

    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Delivery pricing must start at 0, be continuous, non-overlapping, and have strictly increasing prices.';
  }
}

export class AvailabilityDto {
  @IsString()
  @IsIn(
    [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ],
    { message: 'Day must be a valid, capitalized weekday (e.g. Monday)' },
  )
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
  @Validate(DeliveryPricingKmArrayValidator)
  @Type(() => DeliveryPricingKmDto)
  deliveryPricingKm?: DeliveryPricingKmDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto[];
}
