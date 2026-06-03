import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/input/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/input/update-restaurant.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import {
  RestaurantRoleGuard,
  RestaurantRoles,
} from 'src/common/guards/restaurant-role.guard';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe()) createRestaurantDto: CreateRestaurantDto,
  ) {
    return this.restaurantsService.create(createRestaurantDto, user);
  }

  @Get('check-name')
  checkName(@Query('name') name: string) {
    return this.restaurantsService.checkName(name);
  }

  @Get()
  findAll() {
    return this.restaurantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurantsService.findOne(id);
  }

  @Patch(':id/toggle-closed')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  toggleClosed(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.toggleClosed(id, user);
  }

  @Patch(':id/restore')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  restore(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.restore(id, user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.update(id, updateRestaurantDto, user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantsService.remove(id, user);
  }
}
