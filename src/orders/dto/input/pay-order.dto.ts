import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class PayOrderDto {
  @ValidateIf((o) => !o.mobileMoneyPhoneNumber) // Required if phone number is missing
  @IsString()
  paymentMethodId?: string;

  @ValidateIf((o) => !o.paymentMethodId) // Required if payment method ID is missing
  @IsString()
  @Matches(/^(?:\+237|237)?6\d{8}$/, {
    message:
      'Enter a valid Cameroonian phone number (e.g. 670123456 or +237670123456)',
  })
  mobileMoneyPhoneNumber?: string;
}
