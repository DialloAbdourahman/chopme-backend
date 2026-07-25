import { Expose, Transform, Type } from 'class-transformer';
import { CategoryPublicOutputDto } from 'src/categories/dto/output/category-output.dto';
import { computePriceWithPlatformPercentage } from 'src/common/utils/compute-price-with-platform-percentage';
import { env } from 'src/config/env';
import { RestaurantPublicOutputDto } from 'src/restaurants/dto/output/restaurant-output.dto';

export class MenuOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  name: string;

  @Expose()
  @Type(() => CategoryPublicOutputDto)
  category: CategoryPublicOutputDto;

  @Expose()
  description?: string;

  @Expose()
  coverImage?: string;

  @Expose()
  pictures: string[];

  @Expose()
  price: number;

  @Expose()
  @Transform(({ obj }) => {
    const { price } = obj;
    return computePriceWithPlatformPercentage({
      platformPercentage: env.platformPercentage,
      price,
      roundToNearestFCFA: env.roundToNearestFCFA,
    });
  })
  priceWithPlatformPercentage: number;

  @Expose()
  available: boolean;

  // @Expose()
  // rating: {
  //   average: number;
  //   total: number;
  // };

  @Expose()
  ordersCount: number;

  @Expose()
  createdAt: Date;
}

export class MenuPublicOutputDto extends MenuOutputDto {
  @Expose()
  @Transform(({ obj }) => obj.restaurant._id?.toString())
  restaurantId: string;
}

export class MenuPublicWithCompleteRestaurantOutputDto extends MenuOutputDto {
  @Expose()
  restaurant: RestaurantPublicOutputDto;
}

export class MenuPrivateOutputDto extends MenuPublicOutputDto {
  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
