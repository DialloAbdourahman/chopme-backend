import { Expose, Transform, Type } from 'class-transformer';
import { EnumTransferDirection } from 'src/common/enums/transfer-direction';
import { RestaurantPublicOutputDto } from 'src/restaurants/dto/output/restaurant-output.dto';
import { TransferGroupOutputDto } from './transfer-group-output.dto';

export class TransferPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Transform(
    ({ obj }) => obj.restaurant?._id?.toString() || obj.restaurant?.toString(),
  )
  restaurantId: string;

  @Expose()
  status: string;

  @Expose()
  amount: number;

  @Expose()
  @Transform(
    ({ obj }) =>
      obj.transferGroup?._id?.toString() || obj.transferGroup?.toString(),
  )
  transferGroupId: string;

  @Expose()
  transferDirection: EnumTransferDirection;

  @Expose()
  @Transform(
    ({ obj }) =>
      obj.retriedFromTransferId?._id?.toString() ||
      obj.retriedFromTransferId?.toString(),
  )
  retriedFromTransferId?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class TransferPrivateOutputDto extends TransferPublicOutputDto {
  @Expose()
  totalOrders: number;

  @Expose()
  transferId: string;

  @Expose()
  @Type(() => RestaurantPublicOutputDto)
  restaurant: RestaurantPublicOutputDto;

  @Expose()
  @Type(() => TransferGroupOutputDto)
  transferGroup: TransferGroupOutputDto;

  @Expose()
  deletedAt: Date | null;

  @Expose()
  deleted: boolean;
}
