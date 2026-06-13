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
import { RestaurantMembersService } from './restaurant-members.service';
import { CreateRestaurantMemberDto } from './dto/input/create-restaurant-member.dto';
import { UpdateRestaurantMemberDto } from './dto/input/update-restaurant-member.dto';
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
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe())
    createRestaurantMemberDto: CreateRestaurantMemberDto,
  ) {
    return this.restaurantMembersService.create(
      createRestaurantMemberDto,
      user,
    );
  }

  @Get()
  findAll() {
    return this.restaurantMembersService.findAll();
  }

  @Get('me')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  findOne(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantMembersService.findOne(user);
  }

  @Patch(':id/role')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  updateRole(
    @Param('id') id: string,
    @Query('role') role: EnumRestaurantMemberRole,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantMembersService.updateRole(id, role, user);
  }

  @Patch(':id/restore')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  restore(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantMembersService.restore(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRestaurantMemberDto: UpdateRestaurantMemberDto,
  ) {
    return this.restaurantMembersService.update(+id, updateRestaurantMemberDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantMembersService.remove(id, user);
  }
}
