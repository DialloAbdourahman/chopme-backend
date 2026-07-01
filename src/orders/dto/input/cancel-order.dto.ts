import { IsEnum } from 'class-validator';
import { EnumOrderCancelledReason } from 'src/common/enums/order-cancelled-reason';

export class CancelOrderDto {
  @IsEnum(EnumOrderCancelledReason)
  reason: EnumOrderCancelledReason;
}
