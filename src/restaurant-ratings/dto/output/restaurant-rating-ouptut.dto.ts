import { Expose, Transform } from 'class-transformer';

export class RestaurantRatingOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Transform(({ obj }) => obj.client?.toString())
  clientId: string;

  @Expose()
  @Transform(({ obj }) => obj.restaurant?.toString())
  restaurantId: string;

  @Expose()
  rating: number;

  @Expose()
  comment: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
