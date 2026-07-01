import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/input/create-order.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { CancelOrderDto } from './dto/input/cancel-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Put(':orderId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  update(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.update(orderId, createOrderDto, user);
  }

  @Post(':orderId/pay')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  pay(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.pay(orderId, user);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  cancelOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.cancelOrder(orderId, user);
  }

  @Post(':orderId/restaurant-cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  cancelOrderRestaurant(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() cancelOrderDto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrderRestaurant({
      orderId,
      user,
      reason: cancelOrderDto.reason,
    });
  }

  @Get('my-orders')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  getMyOrders(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.ordersService.getMyOrders(user, parsedPage, parsedLimit);
  }

  @Get('restaurant-orders')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  getRestaurantOrders(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.ordersService.getRestaurantOrders(
      user,
      parsedPage,
      parsedLimit,
    );
  }

  @Get(':orderId/client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  getOrderClient(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.getOrderClient(orderId, user);
  }
}
