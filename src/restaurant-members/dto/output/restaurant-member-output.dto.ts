import { Expose, Transform, Type } from 'class-transformer';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { RestaurantPrivateOutputDto } from 'src/restaurants/dto/output/restaurant-output.dto';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';

export class RestaurantMemberOutputDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @Expose()
  @Type(() => RestaurantPrivateOutputDto)
  restaurant: RestaurantPrivateOutputDto;

  @Expose()
  role: EnumRestaurantMemberRole;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => UserPublicOutputDto)
  user?: UserPublicOutputDto;

  @Expose()
  deletedAt: Date | null;

  @Expose()
  deleted: boolean;
}
