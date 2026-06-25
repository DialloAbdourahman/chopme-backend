import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/input/create-category.dto';
import { UpdateCategoryDto } from './dto/input/update-category.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import {
  RestaurantRoleGuard,
  RestaurantRoles,
} from 'src/common/guards/restaurant-role.guard';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(createCategoryDto, user);
  }

  @Get('restaurant/:restaurantId')
  findAll(@Param('restaurantId') restaurantId: string) {
    return this.categoriesService.findAll(restaurantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id/restore')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  restore(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.categoriesService.restore(id, user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  update(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  remove(@Param('id') id: string, @CurrentUser() user: ILoggedInUserTokenData) {
    return this.categoriesService.remove(id, user);
  }
}
