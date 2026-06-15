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
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/input/create-menu.dto';
import { UpdateMenuDto } from './dto/input/update-menu.dto';
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

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe()) createMenuDto: CreateMenuDto,
  ) {
    return this.menusService.create(createMenuDto, user);
  }

  @Get()
  findAll() {
    return this.menusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menusService.findOne(+id);
  }

  @Patch(':id/toggle-available')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  toggleAvailable(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.menusService.toggleAvailable(id, user);
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
    @Body(new ValidationPipe()) updateMenuDto: UpdateMenuDto,
  ) {
    return this.menusService.update(id, updateMenuDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menusService.remove(+id);
  }
}
