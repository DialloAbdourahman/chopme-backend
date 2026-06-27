import { Controller, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/input/create-order.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Put(':orderId')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  update(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.update(orderId, createOrderDto, user);
  }
}
