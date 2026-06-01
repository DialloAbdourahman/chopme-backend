import { Expose, Type } from 'class-transformer';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';

export class ClientPublicOutputDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => UserPublicOutputDto)
  user: UserPublicOutputDto;

  @Expose()
  address: {
    country: string;
    city: string;
    longitude: number;
    latitude: number;
  };

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class ClientPrivateOutputDto extends ClientPublicOutputDto {
  @Expose()
  deletedAt: Date | null;
}
