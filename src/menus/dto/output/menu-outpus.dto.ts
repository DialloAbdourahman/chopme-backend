import { Expose, Transform, Type } from 'class-transformer';
import { RestaurantPublicOutputDto } from 'src/restaurants/dto/output/restaurant-output.dto';

export class MenuPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  name: string;

  @Expose()
  @Type(() => RestaurantPublicOutputDto)
  restaurant: RestaurantPublicOutputDto;

  @Expose()
  category: string;

  @Expose()
  description?: string;

  @Expose()
  coverImage?: string;

  @Expose()
  pictures: string[];

  @Expose()
  price: number;

  @Expose()
  available: boolean;

  @Expose()
  rating: {
    average: number;
    total: number;
  };

  @Expose()
  createdAt: Date;
}

export class MenuPrivateOutputDto extends MenuPublicOutputDto {
  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
