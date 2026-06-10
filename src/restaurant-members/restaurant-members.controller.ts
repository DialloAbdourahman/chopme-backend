import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RestaurantMembersService } from './restaurant-members.service';
import { CreateRestaurantMemberDto } from './dto/input/create-restaurant-member.dto';
import { UpdateRestaurantMemberDto } from './dto/input/update-restaurant-member.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';

@Controller('restaurant-members')
export class RestaurantMembersController {
  constructor(
    private readonly restaurantMembersService: RestaurantMembersService,
  ) {}

  @Post()
  create(@Body() createRestaurantMemberDto: CreateRestaurantMemberDto) {
    return this.restaurantMembersService.create(createRestaurantMemberDto);
  }

  @Get()
  findAll() {
    return this.restaurantMembersService.findAll();
  }

  @Get('profile')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  findOne(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantMembersService.findOne(user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRestaurantMemberDto: UpdateRestaurantMemberDto,
  ) {
    return this.restaurantMembersService.update(+id, updateRestaurantMemberDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.restaurantMembersService.remove(+id);
  }
}
