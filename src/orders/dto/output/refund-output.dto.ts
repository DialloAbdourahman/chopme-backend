import { Expose, Transform, Type } from 'class-transformer';
import { EnumRefundStatus } from 'src/common/enums/refund-statuses';

class RefundDetailsOutputDto {
  @Expose()
  refundId?: string;

  @Expose()
  refundedTransactionId?: string;

  @Expose()
  amount?: number;

  @Expose()
  currencyCode?: string;

  @Expose()
  status?: string;

  @Expose()
  merchantRefundRef?: string;

  @Expose()
  note?: string;

  @Expose()
  reasonCode?: string;

  @Expose()
  createdAt?: string;

  @Expose()
  approvedAt?: string;
}

class RefundWebhookDetailsOutputDto {
  @Expose()
  webhookId?: string;

  @Expose()
  refundId?: string;

  @Expose()
  refundedTransactionId?: string;

  @Expose()
  amount?: number;

  @Expose()
  currencyCode?: string;

  @Expose()
  status?: string;

  @Expose()
  merchantRefundRef?: string;

  @Expose()
  note?: string;

  @Expose()
  reasonCode?: number;

  @Expose()
  reason?: string;

  @Expose()
  createdAt?: string;

  @Expose()
  approvedAt?: string;
}

export class RefundPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Transform(({ obj }) => obj.order?._id?.toString() || obj.order?.toString())
  orderId: string;

  @Expose()
  status: EnumRefundStatus;
}

export class RefundPrivateOutputDto extends RefundPublicOutputDto {
  @Expose()
  @Transform(
    ({ obj }) => obj.restaurant?._id?.toString() || obj.restaurant?.toString(),
  )
  restaurantId?: string;

  @Expose()
  transactionId?: string;

  @Expose()
  @Type(() => RefundDetailsOutputDto)
  refundDetails?: RefundDetailsOutputDto;

  @Expose()
  @Type(() => RefundWebhookDetailsOutputDto)
  refundWebhookDetails?: RefundWebhookDetailsOutputDto;

  @Expose()
  createdAt: Date;
}
