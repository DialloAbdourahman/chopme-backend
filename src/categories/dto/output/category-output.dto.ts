import { Expose, Transform } from 'class-transformer';

export class CategoryPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string;
}

export class CategoryPrivateOutputDto extends CategoryPublicOutputDto {
  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
