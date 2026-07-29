import { Expose, Transform, Type } from 'class-transformer';
import { EnumNetwork } from 'src/common/enums/networks';
import { EnumWalletTypes } from 'src/common/enums/wallet-types';
import { computePriceWithPlatformPercentage } from 'src/common/utils/compute-price-with-platform-percentage';
import { env } from 'src/config/env';

export class MobileWalletDataOutputDto {
  @Expose()
  network: string;

  @Expose()
  number: string;
}

export class RestaurantWalletOutputDto {
  @Expose()
  @Transform(({ obj }) => obj.wallet?.type)
  type: EnumWalletTypes;

  @Expose()
  @Transform(({ obj }) => obj.wallet?.mobileData)
  @Type(() => MobileWalletDataOutputDto)
  mobileData?: MobileWalletDataOutputDto;
}

export class RestaurantPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  slogan?: string;

  @Expose()
  description?: string;

  @Expose()
  phone?: string;

  @Expose()
  email?: string;

  @Expose()
  type: string;

  @Expose()
  address: {
    country: string;
    city: string;
    countryCode: string;
    state?: string;
    longName?: string;
  };

  @Expose()
  location: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Expose()
  rating: {
    average: number;
    total: number;
  };

  @Expose()
  totalViews: number;

  @Expose()
  coverImage?: string;

  @Expose()
  pictures: string[];

  @Expose()
  @Transform(({ obj }) =>
    obj.deliveryPricingKm?.map(
      (tier: { from: number; to: number; price: number }) => ({
        ...tier,
        priceWithPlatformPercentage: computePriceWithPlatformPercentage({
          price: tier.price,
          platformPercentage:
            env.collectionPercentage + env.disbursementPercentage,
          roundToNearestFCFA: env.roundToNearestFCFA,
        }),
      }),
    ),
  )
  deliveryPricingKm: {
    from: number;
    to: number;
    price: number;
    priceWithPlatformPercentage: number;
  }[];

  @Expose()
  isClosed: boolean;

  @Expose()
  @Transform(({ obj }) => {
    if (obj.distance) {
      return Math.round((obj.distance / 1000) * 100) / 100;
    }
    return undefined;
  })
  distanceKm?: number;

  @Expose()
  availability: {
    day: string;
    openTime: string;
    closeTime: string;
  }[];

  @Expose()
  createdAt: Date;
}

export class RestaurantPrivateOutputDto extends RestaurantPublicOutputDto {
  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
