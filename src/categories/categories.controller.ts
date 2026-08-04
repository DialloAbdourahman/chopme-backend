import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseBoolPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Post,
  Query,
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
  @HttpCode(HttpStatus.CREATED)
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

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  search(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('deleted', new DefaultValuePipe(false), ParseBoolPipe)
    deleted?: boolean,
  ) {
    return this.categoriesService.search(
      { search, page, limit, deleted },
      user,
    );
  }

  @Get('restaurant/:restaurantId')
  @HttpCode(HttpStatus.OK)
  findAll(@Param('restaurantId') restaurantId: string) {
    return this.categoriesService.findAll(restaurantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
