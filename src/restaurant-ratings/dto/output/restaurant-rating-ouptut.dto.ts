import { Expose, Transform } from 'class-transformer';

export class RestaurantRatingOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  publicUserName: string;

  @Expose()
  rating: number;

  @Expose()
  comment: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deleted: boolean;
}
