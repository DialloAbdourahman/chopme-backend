import { Expose, Transform, Type } from 'class-transformer';
// import { RestaurantPublicOutputDto } from 'src/restaurants/dto/output/restaurant-output.dto';
// import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';

export class RestaurantMemberPublicOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  // @Expose()
  // @Type(() => RestaurantPublicOutputDto)
  // restaurant: RestaurantPublicOutputDto;

  // @Expose()
  // @Type(() => UserPublicOutputDto)
  // user: UserPublicOutputDto;

  @Expose()
  role: EnumRestaurantMemberRole;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  isOwner: boolean;
}

export class RestaurantMemberPrivateOutputDto extends RestaurantMemberPublicOutputDto {
  @Expose()
  deletedAt: Date | null;
}
