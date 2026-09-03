import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/input/create-order.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { CancelOrderDto } from './dto/input/cancel-order.dto';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { RestaurantRoles } from 'src/common/guards/restaurant-role.guard';

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

  @Patch(':orderId/update-order-status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  updateOrderStatus(
    @Param('orderId') orderId: string,
    @Query('status') status: EnumOrderStatus,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.updateOrderStatus({
      orderId,
      user,
      status,
    });
  }

  @Get('my-orders')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  getMyOrders(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('status') status: EnumOrderStatus,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.ordersService.getMyOrders({
      user,
      status,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get('restaurant-orders')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  getRestaurantOrders(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('status') status: EnumOrderStatus,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.ordersService.getRestaurantOrders({
      user,
      status,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get('restaurant-orders/count')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  countRestaurantOrders(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('status') status: EnumOrderStatus,
  ) {
    return this.ordersService.countRestaurantOrders({
      user,
      status,
    });
  }

  @Get('restaurant-orders/sum-amount')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.OWNER)
  sumRestaurantOrdersAmount(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Query('statuses') statuses: string,
    @Query('excludeTransferred') excludeTransferred?: string,
  ) {
    const parsedStatuses = (statuses ? statuses.split(',') : []).map(
      (status) => status.trim() as EnumOrderStatus,
    );
    return this.ordersService.sumRestaurantOrdersAmount({
      user,
      statuses: parsedStatuses,
      excludeTransferred: excludeTransferred === 'true',
    });
  }

  @Get(':orderId/get-client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  getOrderClient(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.getOrderClient(orderId, user);
  }

  @Get(':orderId/restaurant')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  getOrderByIdAndRestaurant(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.getOrderByIdAndRestaurant(orderId, user);
  }

  @Get(':orderId/restaurant/client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  getRestaurantOfOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.getRestaurantOfOrder(orderId, user);
  }

  @Get(':orderId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  getOrderByIdAndClient(
    @Param('orderId') orderId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.ordersService.getOrderByIdAndClient(orderId, user);
  }
}
