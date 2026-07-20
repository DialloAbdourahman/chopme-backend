import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAddressDto {
  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;

  @IsString()
  country: string;

  @IsString()
  city: string;
}
