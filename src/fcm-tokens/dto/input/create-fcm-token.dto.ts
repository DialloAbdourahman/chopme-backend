import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  installationId: string;
}
