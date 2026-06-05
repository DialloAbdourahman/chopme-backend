import { IsNumber } from 'class-validator';

export class UpdateAddressDto {
  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;
}
