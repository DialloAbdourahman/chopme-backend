import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { RestaurantMembersService } from './restaurant-members.service';
import { CreateRestaurantMemberDto } from './dto/input/create-restaurant-member.dto';
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

@Controller('restaurant-members')
export class RestaurantMembersController {
  constructor(
    private readonly restaurantMembersService: RestaurantMembersService,
  ) {}

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
    @Body()
    createRestaurantMemberDto: CreateRestaurantMemberDto,
  ) {
    return this.restaurantMembersService.create(
      createRestaurantMemberDto,
      user,
    );
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
    @Query('role') role?: EnumRestaurantMemberRole,
    @Query('deleted', new DefaultValuePipe(false), ParseBoolPipe)
    deleted?: boolean,
  ) {
    return this.restaurantMembersService.search(
      { search, page, limit, role, deleted },
      user,
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  findOne(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantMembersService.findOne(user);
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  updateRole(
    @Param('id') id: string,
    @Query('role') role: EnumRestaurantMemberRole,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantMembersService.updateRole(id, role, user);
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
    return this.restaurantMembersService.restore(id, user);
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
    return this.restaurantMembersService.remove(id, user);
  }
}
