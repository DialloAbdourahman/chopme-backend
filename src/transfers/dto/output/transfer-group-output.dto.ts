import { Expose, Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { EnumTranzakTopupStatus } from 'src/common/enums/tranzak/topup-status';

export class TransferGroupOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  restaurantAmount: number;

  @Expose()
  platformAmount: number;

  @Expose()
  totalAmount: number;

  @Expose()
  totalTopupAmount: number;

  @Expose()
  @Transform(({ obj }) =>
    (obj.transfers ?? []).map((transfer: Types.ObjectId) =>
      transfer.toString(),
    ),
  )
  transfers: string[];

  @Expose()
  topupStatus?: EnumTranzakTopupStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;

  @Expose()
  deleted: boolean;
}
