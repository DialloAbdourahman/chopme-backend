import { IsEnum, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { EnumWalletTypes } from 'src/common/enums/wallet-types';

export class AddRestaurantWalletDto {
  @IsEnum(EnumWalletTypes)
  type: EnumWalletTypes;

  @IsOptional()
  @IsNotEmpty()
  @Matches(/^\+2376\d{8}$/, {
    message:
      'Phone number must be a valid Cameroonian number in the format +237620487789',
  })
  number?: string;
}
