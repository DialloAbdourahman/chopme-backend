import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateTransferDto {
  @IsMongoId()
  @IsNotEmpty()
  restaurantId: string;
}
