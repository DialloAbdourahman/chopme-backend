import { Expose } from 'class-transformer';

export class ClientPublicOutputDto {
  @Expose()
  id: string;

  @Expose()
  customer_id: string;

  @Expose()
  userId: string;

  @Expose()
  address: {
    country: string;
    city: string;
    longitude: number;
    latitude: number;
  };
}

export class ClientPrivateOutputDto extends ClientPublicOutputDto {
  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt: Date | null;
}
