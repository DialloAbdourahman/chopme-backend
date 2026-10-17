import { Expose, Transform } from 'class-transformer';
import { EnumTransferDirection } from 'src/common/enums/transfer-direction';

export class TransferPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Transform(({ obj }) => obj.restaurant?.toString())
  restaurantId: string;

  @Expose()
  status: string;

  @Expose()
  amount: number;

  @Expose()
  @Transform(({ obj }) => obj.transferGroupId?.toString())
  transferGroupId: string;

  @Expose()
  transferDirection: EnumTransferDirection;

  @Expose()
  totalPlatformAmount: number;

  @Expose()
  transferId: number;

  @Expose()
  platformTransferStatus: string;

  @Expose()
  restaurantTransferStatus: string;

  @Expose()
  totalOrders: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class TransferPrivateOutputDto extends TransferPublicOutputDto {
  @Expose()
  deletedAt: Date | null;

  @Expose()
  deleted: boolean;
}
