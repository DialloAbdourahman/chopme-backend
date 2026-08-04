import { Expose, Transform, Type } from 'class-transformer';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';

export class ClientPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  address: {
    country: string;
    city: string;
    longitude: number;
    latitude: number;
  };

  @Expose()
  phoneNumber: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class ClientPublicWithUserOutputDto extends ClientPublicOutputDto {
  @Expose()
  @Type(() => UserPublicOutputDto)
  user: UserPublicOutputDto;
}

export class ClientPrivateOutputDto extends ClientPublicOutputDto {
  @Expose()
  deletedAt: Date | null;

  @Expose()
  deleted: boolean;
}
