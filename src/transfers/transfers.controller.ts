import {
  Controller,
  Post,
  Get,
  HttpCode,
  UseGuards,
  HttpStatus,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { RestaurantRoles } from 'src/common/guards/restaurant-role.guard';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.OWNER)
  create(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.transfersService.create(user);
  }

  @Get('restaurant-transfers')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.OWNER)
  getRestaurantTransfers(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: EnumTransferStatuses,
  ) {
    return this.transfersService.getRestaurantTransfers({
      user,
      page,
      limit,
      status,
    });
  }

  @Post(':transferId/start-transfer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  startTransfer(
    @Param('transferId') transferId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.transfersService.startTransfer({ transferId, user });
  }
}
