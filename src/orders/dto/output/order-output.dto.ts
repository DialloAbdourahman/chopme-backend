import { Expose, Transform, Type } from 'class-transformer';
import { ClientPublicOutputDto } from 'src/clients/dto/output/client-output.dto';
import { RestaurantPublicOutputDto } from 'src/restaurants/dto/output/restaurant-output.dto';
import { EnumOrderStatus } from 'src/common/enums/order-status';

class OrderItemPublicOutputDto {
  @Expose()
  @Transform(
    ({ obj }) => obj.product?._id?.toString() || obj.product?.toString(),
  )
  productId: string;

  @Expose()
  quantity: number;

  @Expose()
  originalPrice: number;

  @Expose()
  priceWithPlatformPercentage: number;
}

class StatusTransitionOutputDto {
  @Expose()
  status: EnumOrderStatus;

  @Expose()
  timestamp: Date;
}

class PaymentDetails {
  @Expose()
  link: string;

  @Expose()
  validUntil: Date;
}

class PricingRestaurantOutputDto {
  @Expose()
  restaurantAmount: number;

  @Expose()
  restaurantAmountWithDelivery: number;

  @Expose()
  deliveryFeeAmount: number;
}

class PricingClientOutputDto {
  @Expose()
  totalAmountCollected: number;

  @Expose()
  totalAmountCollectedWithDelivery: number;

  @Expose()
  deliveryFeeAmountWithCollectionAndDisbursementPercentage: number;
}

class PricingAdminOutputDto {
  @Expose()
  restaurantAmount: number;

  @Expose()
  restaurantAmountWithDelivery: number;

  @Expose()
  deliveryFeeAmount: number;

  @Expose()
  totalAmountCollected: number;

  @Expose()
  totalAmountCollectedWithDelivery: number;

  @Expose()
  deliveryFeeAmountWithCollectionAndDisbursementPercentage: number;

  @Expose()
  platformEarningsAmount: number;
}

class MetaDataOutputDto {
  @Expose()
  platformPercentage: number;

  @Expose()
  collectionPercentage: number;

  @Expose()
  disbursementPercentage: number;
}

abstract class OrderOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Transform(({ obj }) => obj.client?._id?.toString() || obj.client?.toString())
  clientId: ClientPublicOutputDto;

  @Expose()
  @Transform(
    ({ obj }) => obj.restaurant?._id?.toString() || obj.restaurant?.toString(),
  )
  restaurantId: RestaurantPublicOutputDto;

  @Expose()
  status: string;

  @Expose()
  refundStatus;

  @Expose()
  distanceKm: number;

  @Expose()
  @Type(() => StatusTransitionOutputDto)
  statusTransitions: StatusTransitionOutputDto;

  @Expose()
  @Type(() => OrderItemPublicOutputDto)
  items: OrderItemPublicOutputDto[];

  @Expose()
  maxTimeToPayOrder?: Date;

  @Expose()
  paidAt?: Date;

  @Expose()
  orderCancelReason?: string;

  @Expose()
  createdAt: Date;
}

export class OrderRestaurantOutputDto extends OrderOutputDto {
  @Expose()
  @Type(() => PricingRestaurantOutputDto)
  pricing: PricingRestaurantOutputDto;
}

export class OrderClientOutputDto extends OrderOutputDto {
  @Expose()
  @Type(() => PricingClientOutputDto)
  pricing: PricingClientOutputDto;

  @Expose()
  @Type(() => PaymentDetails)
  paymentDetails: PaymentDetails;
}

export class OrderAdminOutputDto extends OrderOutputDto {
  @Expose()
  @Type(() => PricingAdminOutputDto)
  pricing: PricingAdminOutputDto;

  // @Expose()
  // @Type(() => OrderItemPrivateOutputDto)
  // declare items: OrderItemPrivateOutputDto[];

  @Expose()
  @Type(() => MetaDataOutputDto)
  metaData: MetaDataOutputDto;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
