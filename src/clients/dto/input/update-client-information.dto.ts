import { IsOptional, Matches } from 'class-validator';

export class UpdateClientInformationDto {
  @IsOptional()
  @Matches(/^\+2376\d{8}$/, {
    message:
      'Phone number must be a valid Cameroonian number in the format +237620487789',
  })
  phoneNumber?: string;
}
