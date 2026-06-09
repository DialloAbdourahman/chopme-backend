import { Expose, Transform } from 'class-transformer';

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
  deliveryPricingKm: {
    from: number;
    to: number;
    price: number;
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
