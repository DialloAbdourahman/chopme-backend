import { Expose, Transform } from 'class-transformer';

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
  totalRestaurantAmount: number;

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
}
