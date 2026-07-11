import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAddressDto {
  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;

  @IsString()
  @IsOptional()
  country: string;

  @IsString()
  @IsOptional()
  city: string;
}
