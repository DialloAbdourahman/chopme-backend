import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOrderDto } from './dto/input/create-order.dto';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { Client, ClientDocument } from 'src/clients/entities/client.entity';
import {
  Restaurant,
  RestaurantDocument,
} from 'src/restaurants/entities/restaurant.entity';
import { computeDistanceBetweenTwoPoints } from 'src/common/utils/compute-distance-between-two-points';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Menu.name) private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async create(createOrderDto: CreateOrderDto, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[create] Order request by clientId=${user.clientId} for restaurantId=${createOrderDto.restaurantId}`,
    );
    await this.ensureCanOrder({ user, createOrderDto });
    return 'This action adds a new order';
  }

  private async ensureCanOrder({
    user,
    createOrderDto,
  }: {
    createOrderDto: CreateOrderDto;
    user: ILoggedInUserTokenData;
  }): Promise<{
    deliveryTier: {
      from: number;
      to: number;
      price: number;
    };
    orders: { menu: MenuDocument; quantity: number }[];
  }> {
    const productIds = createOrderDto.items.map((item) => item.productId);
    this.logger.log(
      `[ensureCanOrder] Starting validation for clientId=${user.clientId}, restaurantId=${createOrderDto.restaurantId}, items=${productIds.length}`,
    );

    // Make sure that the restaurant exists
    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(createOrderDto.restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.warn(
        `[ensureCanOrder] Restaurant not found: restaurantId=${createOrderDto.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RESTAURANT_NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }
    this.logger.log(
      `[ensureCanOrder] Restaurant found: id=${restaurant._id}, name=${restaurant.name}`,
    );

    // Make sure restaurant is not manually closed
    if (restaurant.isClosed) {
      this.logger.warn(
        `[ensureCanOrder] Restaurant is manually closed: restaurantId=${restaurant._id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RESTAURANT_CLOSED,
        message: 'Restaurant is closed',
        code: 400,
      });
    }

    // Make sure that restaurant is opened currently
    const now = new Date();
    const cameroonLocale = { timeZone: 'Africa/Douala' };
    const dayName = now.toLocaleDateString('en-US', {
      weekday: 'long',
      ...cameroonLocale,
    });
    const currentTime = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...cameroonLocale,
    });

    const todaySchedule = restaurant.availability.find(
      (a) => a.day === dayName,
    );

    if (
      !todaySchedule ||
      currentTime < todaySchedule.openTime ||
      currentTime > todaySchedule.closeTime
    ) {
      this.logger.warn(
        `[ensureCanOrder] Restaurant not open: day=${dayName}, currentTime=${currentTime}, schedule=${JSON.stringify(todaySchedule)}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RESTAURANT_CLOSED,
        message: 'Restaurant is not open at this time',
        code: 400,
      });
    }
    this.logger.log(
      `[ensureCanOrder] Restaurant is open: day=${dayName}, currentTime=${currentTime}, openTime=${todaySchedule.openTime}, closeTime=${todaySchedule.closeTime}`,
    );

    // Make sure that the client exists
    const client = await this.clientModel.findOne({
      _id: new Types.ObjectId(user.clientId),
      deleted: false,
    });

    if (!client) {
      this.logger.warn(
        `[ensureCanOrder] Client not found: clientId=${user.clientId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CLIENT_NOT_FOUND,
        message: 'Client not found',
        code: 404,
      });
    }
    this.logger.log(`[ensureCanOrder] Client found: id=${client._id}`);

    // Make sure that the client has entered all the required information before ordering
    if (
      !client.address?.longitude ||
      !client.address?.latitude ||
      !client.phone_number
    ) {
      this.logger.warn(
        `[ensureCanOrder] Client information incomplete: clientId=${client._id}, hasAddress=${!!client.address}, hasPhone=${!!client.phone_number}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CLIENT_INFORMATION_INCOMPLETE,
        message: 'Client address not found',
        code: 404,
      });
    }

    // Make sure that the client is not too far from the restaurant.
    const distanceBetweenRestaurantAndClient = computeDistanceBetweenTwoPoints({
      from: {
        latitude: restaurant.location.coordinates[1],
        longitude: restaurant.location.coordinates[0],
      },
      to: {
        latitude: client.address.latitude,
        longitude: client.address.longitude,
      },
    });

    const deliveryTier = restaurant.deliveryPricingKm.find(
      (tier) =>
        distanceBetweenRestaurantAndClient >= tier.from &&
        distanceBetweenRestaurantAndClient <= tier.to,
    );

    this.logger.log(
      `[ensureCanOrder] Distance to restaurant: ${distanceBetweenRestaurantAndClient.toFixed(2)}km`,
    );

    if (!deliveryTier) {
      this.logger.warn(
        `[ensureCanOrder] Client too far: distance=${distanceBetweenRestaurantAndClient.toFixed(2)}km, clientId=${client._id}, restaurantId=${restaurant._id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.TOO_FAR,
        message: 'Delivery is not available for your location',
        code: 400,
      });
    }
    this.logger.log(
      `[ensureCanOrder] Delivery tier matched: from=${deliveryTier.from}km, to=${deliveryTier.to}km, price=${deliveryTier.price}`,
    );

    // Make sure that that the menus exists
    const menus = await this.menuModel
      .find({ _id: { $in: productIds }, deleted: false })
      .exec();

    if (menus.length !== productIds.length) {
      this.logger.warn(
        `[ensureCanOrder] Menu mismatch: requested=${productIds.length}, found=${menus.length}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ONE_OF_THE_MENUS_DOES_NOT_EXIST,
        message: 'One or more products were not found',
        code: 404,
      });
    }
    this.logger.log(`[ensureCanOrder] All ${menus.length} menu item(s) found`);

    // Make sure that the menus belong to the same restaurant
    const allBelongToRestaurant = menus.every(
      (menu) => menu.restaurant.toString() === createOrderDto.restaurantId,
    );

    if (!allBelongToRestaurant) {
      this.logger.warn(
        `[ensureCanOrder] Menu items do not all belong to restaurantId=${createOrderDto.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FROM_SAME_RESTAURANT,
        message: 'All products must belong to the same restaurant',
        code: 400,
      });
    }

    // Make sure that the menu is available.
    const notAvailableMenu = menus.find((menu) => menu.available === false);

    if (notAvailableMenu) {
      this.logger.warn(
        `[ensureCanOrder] Menu item not available: menuId=${notAvailableMenu._id}, name=${notAvailableMenu.name}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ONE_OF_THE_MENUS_IS_NOT_AVAILABLE,
        message: 'One or more products are not available',
        code: 400,
      });
    }

    this.logger.log(
      `[ensureCanOrder] All validations passed for clientId=${user.clientId}, restaurantId=${createOrderDto.restaurantId}`,
    );

    return {
      orders: createOrderDto.items.map((item) => ({
        menu: menus.find((m) => m._id.toString() === item.productId)!,
        quantity: item.quantity,
      })),
      deliveryTier,
    };
  }
}
