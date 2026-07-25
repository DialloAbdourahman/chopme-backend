import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { RestaurantRatingsService } from './restaurant-ratings.service';
import { UpdateRestaurantRatingDto } from './dto/input/update-restaurant-rating.dto';
import { CreateRestaurantRatingDto } from './dto/input/create-restaurant-rating.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';

@Controller('restaurants/:restaurantId/ratings')
export class RestaurantRatingsController {
  constructor(
    private readonly restaurantRatingsService: RestaurantRatingsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  create(
    @Param('restaurantId') restaurantId: string,
    @Body() createRestaurantRatingDto: CreateRestaurantRatingDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantRatingsService.create(
      restaurantId,
      createRestaurantRatingDto,
      user,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  getRestaurantRatings(
    @Param('restaurantId') restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('rating', new ParseIntPipe({ optional: true }))
    rating?: number,
  ) {
    return this.restaurantRatingsService.getRestaurantRatings({
      restaurantId,
      page,
      limit,
      rating,
    });
  }

  @Patch(':ratingId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  update(
    @Param('ratingId') ratingId: string,
    @Body() updateRestaurantRatingDto: UpdateRestaurantRatingDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantRatingsService.update(
      ratingId,
      updateRestaurantRatingDto,
      user,
    );
  }

  @Get('my-rating')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  getMyRating(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantRatingsService.getMyRating(restaurantId, user);
  }

  @Delete(':ratingId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  remove(
    @Param('ratingId') ratingId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantRatingsService.remove(ratingId, user);
  }
}
