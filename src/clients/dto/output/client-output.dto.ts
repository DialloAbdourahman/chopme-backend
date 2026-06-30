import { Expose, Type } from 'class-transformer';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';
// import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';

export class ClientPublicOutputDto {
  @Expose()
  id: string;

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

export class ClientPublicWithUserOutputDto extends ClientPublicOutputDto {
  @Expose()
  @Type(() => UserPublicOutputDto)
  user: UserPublicOutputDto;
}

export class ClientPrivateOutputDto extends ClientPublicOutputDto {
  @Expose()
  deletedAt: Date | null;
}
