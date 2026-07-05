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
import { env } from 'src/config/env';
import { Order, OrderDocument, OrderItem } from './entities/order.entity';
import { computePriceWithPlatformPercentage } from 'src/common/utils/compute-price-with-platform-percentage';
import { plainToInstance } from 'class-transformer';
import {
  OrderClientOutputDto,
  OrderRestaurantOutputDto,
} from './dto/output/order-output.dto';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { FlutterwaveService } from 'src/common/flutterwave/flutterwave.service';
import { UserDocument } from 'src/users/entities/user.entity';
import { EnumCurrency } from 'src/common/enums/currencies';
import { Pagination } from 'src/common/interfaces/pagination';
import { ClientPublicWithUserOutputDto } from 'src/clients/dto/output/client-output.dto';
import Flutterwave from 'flutterwave-node-v3';
import { EnumOrderCancelledReason } from 'src/common/enums/order-cancelled-reason';
import { FlutterWaveResponse } from 'src/common/interfaces/flutterwave/response';
import { FlutterwaveRefund } from 'src/common/interfaces/flutterwave/refund';
import { EnumRefundStatus } from 'src/common/enums/refund-statuses';
import { WebSocketService } from 'src/web-socket/web-socket-service';
import { EnumWebSocketEventType } from 'src/common/enums/web-socket-events';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly flw = new Flutterwave(
    env.flutterWaveClientPublicKey,
    env.flutterWaveClientSecretKey,
  );

  constructor(
    @InjectModel(Menu.name) private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly eventsGateway: WebSocketService,
  ) {}

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
    maxTimeToPayOrder: Date;
    createOrderDto?: CreateOrderDto;
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
    const maxTimeToPayOrder = new Date(
      now.getTime() + env.maxTimeToPayOrderInMins * 60 * 1000,
    );
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
      !client.phoneNumber
    ) {
      this.logger.warn(
        `[ensureCanOrder] Client information incomplete: clientId=${client._id}, hasAddress=${!!client.address}, hasPhone=${!!client.phoneNumber}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CLIENT_INFORMATION_INCOMPLETE,
        message: 'Client information incomplete',
        code: 400,
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
      maxTimeToPayOrder,
    };
  }

  private async createOrUpdateOrder({
    createOrderDto,
    user,
    deliveryTier,
    orders,
    maxTimeToPayOrder,
    orderId,
  }: {
    createOrderDto: CreateOrderDto;
    user: ILoggedInUserTokenData;
    deliveryTier: {
      from: number;
      to: number;
      price: number;
    };
    orders: { menu: MenuDocument; quantity: number }[];
    maxTimeToPayOrder: Date;
    orderId?: string;
  }): Promise<OrderDocument> {
    const deliveryPrice = deliveryTier.price;
    const deliveryPriceWithPlatformPercentage =
      computePriceWithPlatformPercentage({
        price: deliveryPrice,
        platformPercentage:
          env.collectionPercentage + env.disbursementPercentage,
        roundToNearestFCFA: env.roundToNearestFCFA,
      });

    const orderItems: OrderItem[] = orders.map((order) => ({
      product: order.menu,
      quantity: order.quantity,
      originalPrice: order.menu.price,
      priceWithPlatformPercentage: computePriceWithPlatformPercentage({
        price: order.menu.price,
        platformPercentage: env.platformPercentage,
        roundToNearestFCFA: env.roundToNearestFCFA,
      }),
    }));

    const totalPrice = orderItems.reduce(
      (acc, item) => acc + item.originalPrice * item.quantity,
      0,
    );
    const totalPriceWithPlatformPercentage = orderItems.reduce(
      (acc, item) => acc + item.priceWithPlatformPercentage * item.quantity,
      0,
    );

    // Calculate platform earnings: platform percentage (20%) - collection percentage (2%) - disbursement percentage (1%)
    // So platform actually earns: 20% - 3% - 1% = 16%
    const platformEarningsPercentage =
      env.platformPercentage -
      env.collectionPercentage -
      env.disbursementPercentage;
    const amountPlatformWillEarn = Math.floor(
      (totalPrice * platformEarningsPercentage) / 100,
    );

    this.logger.log(
      `[createOrUpdate] Order pricing calculated - Items: ${orderItems.length}, TotalPrice: ${totalPrice}, TotalWithPlatform: ${totalPriceWithPlatformPercentage}, DeliveryPrice: ${deliveryPriceWithPlatformPercentage}, PlatformEarnings: ${amountPlatformWillEarn}`,
    );

    const orderData = {
      client: new Types.ObjectId(user.clientId),
      restaurant: new Types.ObjectId(createOrderDto.restaurantId),
      items: orderItems,
      statusTransitions: [
        {
          status: EnumOrderStatus.CREATED,
          timestamp: new Date(),
        },
      ],
      maxTimeToPayOrder: maxTimeToPayOrder,
      pricing: {
        totalAmountCollected: totalPriceWithPlatformPercentage,
        totalAmountCollectedWithDelivery:
          totalPriceWithPlatformPercentage +
          deliveryPriceWithPlatformPercentage,
        restaurantAmount: totalPrice,
        restaurantAmountWithDelivery: totalPrice + deliveryPrice,
        deliveryFeeAmount: deliveryPrice,
        deliveryFeeAmountWithCollectionAndDisbursementPercentage:
          deliveryPriceWithPlatformPercentage,
        platformEarningsAmount: amountPlatformWillEarn,
      },
      metaData: {
        platformPercentage: env.platformPercentage,
        collectionPercentage: env.collectionPercentage,
        disbursementPercentage: env.disbursementPercentage,
      },
    };

    let order: OrderDocument;
    if (orderId) {
      // Update existing order
      const updatedOrder = await this.orderModel.findByIdAndUpdate(
        orderId,
        { $set: orderData },
        { new: true },
      );

      if (!updatedOrder) {
        throw new OrchestrationException({
          statusCode: EnumStatusCode.ORDER_NOT_FOUND,
          message: 'Order not found for update',
          code: 404,
        });
      }

      order = updatedOrder;
      this.logger.log(
        `[createOrUpdate] Order updated successfully - orderId=${order._id}`,
      );
    } else {
      // Create new order
      order = new this.orderModel(orderData);
      await order.save();
      this.logger.log(
        `[createOrUpdate] Order created successfully - orderId=${order._id}`,
      );
    }

    return order;
  }

  async create(createOrderDto: CreateOrderDto, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[create] Order request by clientId=${user.clientId} for restaurantId=${createOrderDto.restaurantId} with ${createOrderDto.items.length} items`,
    );

    const validatedOrder = await this.ensureCanOrder({
      user,
      createOrderDto,
    });

    const order = await this.createOrUpdateOrder({
      createOrderDto,
      user,
      deliveryTier: validatedOrder.deliveryTier,
      orders: validatedOrder.orders,
      maxTimeToPayOrder: validatedOrder.maxTimeToPayOrder,
    });
    const orderObject = order.toObject();
    const publicOrder = plainToInstance(OrderClientOutputDto, orderObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<OrderClientOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicOrder,
      message: 'Order created successfully',
    });
  }

  async update(
    orderId: string,
    createOrderDto: CreateOrderDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[update] Order update request by clientId=${user.clientId} for orderId=${orderId} with ${createOrderDto.items.length} items`,
    );

    // Check if order exists and belongs to the client
    const existingOrder = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      client: new Types.ObjectId(user.clientId),
    });

    if (!existingOrder) {
      this.logger.warn(
        `[update] Order not found or access denied: orderId=${orderId}, clientId=${user.clientId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_NOT_FOUND,
        message: 'Order not found',
        code: 404,
      });
    }

    // Check if order is in CREATED status
    if (existingOrder.status !== EnumOrderStatus.CREATED) {
      this.logger.warn(
        `[update] Order cannot be updated - invalid status: orderId=${orderId}, currentStatus=${existingOrder.status}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_CANNOT_BE_UPDATED,
        message: 'Order can only be updated when in CREATED status',
        code: 400,
      });
    }

    const validatedOrder = await this.ensureCanOrder({
      user,
      createOrderDto,
    });

    const order = await this.createOrUpdateOrder({
      createOrderDto,
      user,
      deliveryTier: validatedOrder.deliveryTier,
      orders: validatedOrder.orders,
      maxTimeToPayOrder: validatedOrder.maxTimeToPayOrder,
      orderId,
    });
    const orderObject = order.toObject();
    const publicOrder = plainToInstance(OrderClientOutputDto, orderObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<OrderClientOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicOrder,
      message: 'Order updated successfully',
    });
  }

  async getMyOrders({
    user,
    status,
    page,
    limit,
  }: {
    user: ILoggedInUserTokenData;
    status: EnumOrderStatus;
    page: number;
    limit: number;
  }) {
    this.logger.log(
      `[getMyOrders] Fetching orders for clientId=${user.clientId}, page=${page}, limit=${limit}`,
    );

    const clientId = new Types.ObjectId(user.clientId);
    const filters: { client: Types.ObjectId; status?: EnumOrderStatus } = {
      client: clientId,
    };

    if (status) {
      filters.status = status;
    }

    const totalItems = await this.orderModel.countDocuments(filters);
    const orders = await this.orderModel
      .find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalItems / limit) || 1;
    const publicOrders = plainToInstance(OrderClientOutputDto, orders, {
      excludeExtraneousValues: true,
    });

    const paginatedResult: Pagination<OrderClientOutputDto> = {
      items: publicOrders,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<OrderClientOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Orders fetched successfully',
    });
  }

  async getRestaurantOrders({
    user,
    page,
    limit,
    status,
  }: {
    user: ILoggedInUserTokenData;
    page: number;
    limit: number;
    status: EnumOrderStatus;
  }) {
    this.logger.log(
      `[getRestaurantOrders] Fetching orders for restaurantId=${user.restaurantId}, page=${page}, limit=${limit}`,
    );

    const restaurantId = new Types.ObjectId(user.restaurantId);
    const activeStatuses = [
      EnumOrderStatus.PAID,
      EnumOrderStatus.PREPARING_ORDER,
      EnumOrderStatus.CANCELLED_BY_RESTAURANT,
      EnumOrderStatus.IN_DELIVERY,
      EnumOrderStatus.DELIVERED,
      EnumOrderStatus.DISBURSED,
    ];

    this.logger.log(
      `[getRestaurantOrders] Filtering orders by statuses: ${activeStatuses.join(', ')}`,
    );

    const filters: {
      status?: EnumOrderStatus | { $in: EnumOrderStatus[] };
      restaurant: Types.ObjectId;
    } = {
      restaurant: restaurantId,
    };

    if (status && !activeStatuses.includes(status)) {
      this.logger.warn(`[getRestaurantOrders] Invalid status: ${status}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CANNOT_FILTER_WITH_STATUS,
        message: `Cannot filter with status ${status}`,
        code: 400,
      });
    }

    if (status) {
      filters.status = status;
    } else {
      filters.status = { $in: activeStatuses };
    }

    console.log(filters);

    const totalItems = await this.orderModel.countDocuments(filters);
    const orders = await this.orderModel
      .find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalItems / limit) || 1;
    const publicOrders = plainToInstance(OrderRestaurantOutputDto, orders, {
      excludeExtraneousValues: true,
    });

    const paginatedResult: Pagination<OrderRestaurantOutputDto> = {
      items: publicOrders,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<OrderRestaurantOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Restaurant orders fetched successfully',
    });
  }

  async cancelOrder(orderId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[cancelOrder] Order cancel request by clientId=${user.clientId} for orderId=${orderId}`,
    );

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      client: new Types.ObjectId(user.clientId),
    });

    if (!order) {
      this.logger.warn(
        `[cancelOrder] Order not found or access denied: orderId=${orderId}, clientId=${user.clientId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_NOT_FOUND,
        message: 'Order not found',
        code: 404,
      });
    }

    if (order.status !== EnumOrderStatus.CREATED) {
      this.logger.warn(
        `[cancelOrder] Order cannot be cancelled - invalid status: orderId=${orderId}, currentStatus=${order.status}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_CANNOT_BE_UPDATED,
        message: 'Order can only be cancelled when in CREATED status',
        code: 400,
      });
    }

    this.logger.log(
      `[cancelOrder] Cancelling order: id=${order._id}, clientId=${user.clientId}`,
    );

    order.status = EnumOrderStatus.CANCELLED_BY_CUSTOMER;
    order.cancelledAt = new Date();
    order.statusTransitions = [
      ...order.statusTransitions,
      {
        status: EnumOrderStatus.CANCELLED_BY_CUSTOMER,
        timestamp: new Date(),
      },
    ];

    await order.save();

    this.logger.log(
      `[cancelOrder] Order cancelled successfully: id=${order._id}, status=${order.status}`,
    );

    const orderObject = order.toObject();
    const publicOrder = plainToInstance(OrderClientOutputDto, orderObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<OrderClientOutputDto>({
      statusCode: EnumStatusCode.CANCELLED_SUCCESSFULLY,
      data: publicOrder,
      message: 'Order cancelled successfully',
    });
  }

  async cancelOrderRestaurant({
    orderId,
    user,
    reason,
  }: {
    orderId: string;
    user: ILoggedInUserTokenData;
    reason: EnumOrderCancelledReason;
  }) {
    this.logger.log(
      `[cancelOrderRestaurant] Order cancel request by restaurantId=${user.restaurantId} for orderId=${orderId}`,
    );

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      restaurant: new Types.ObjectId(user.restaurantId),
    });

    if (!order) {
      this.logger.warn(
        `[cancelOrderRestaurant] Order not found or access denied: orderId=${orderId}, restaurantId=${user.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_NOT_FOUND,
        message: 'Order not found',
        code: 404,
      });
    }

    if (order.status !== EnumOrderStatus.PAID) {
      this.logger.warn(
        `[cancelOrderRestaurant] Order cannot be cancelled - invalid status: orderId=${orderId}, currentStatus=${order.status}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_CANNOT_BE_UPDATED,
        message: 'Order can only be cancelled when in .PAID status',
        code: 400,
      });
    }

    this.logger.log(
      `[cancelOrderRestaurant] Cancelling order: id=${order._id}, restaurantId=${user.restaurantId}`,
    );

    order.status = EnumOrderStatus.CANCELLED_BY_RESTAURANT;
    order.cancelledAt = new Date();
    order.cancelledByRestaurantMember = new Types.ObjectId(
      user.restaurantMemberId,
    );
    order.orderCancelReason = reason;
    order.statusTransitions = [
      ...order.statusTransitions,
      {
        status: EnumOrderStatus.CANCELLED_BY_RESTAURANT,
        timestamp: new Date(),
      },
    ];

    await order.save();

    this.logger.log(
      `[cancelOrderRestaurant] Order cancelled successfully: id=${order._id}, status=${order.status} and initiating refund.`,
    );

    // Initate refund logic here and update order
    const response = (await this.flw.Transaction.refund({
      id: order.paymentWebhookDetails.transactionId?.toString(),
      amount: order.pricing.totalAmountCollectedWithDelivery,
    })) as FlutterWaveResponse<FlutterwaveRefund>;

    if (response.status === 'success' && response.data.status === 'completed') {
      this.logger.log(
        `[cancelOrderRestaurant] Refund initiated successfully: id=${order._id}, refundId=${response.data.id}`,
      );
      order.refundStatus = EnumRefundStatus.INITIATED;
      await order.save();
    } else {
      this.logger.warn(
        `[cancelOrderRestaurant] Refund initiation failed: id=${order._id}, status=${response.status}, message: '${response.message}', data=${JSON.stringify(response.data)}`,
      );
      order.refundStatus = EnumRefundStatus.FAILED_TO_INITIATE;
      await order.save();
    }

    const orderObject = order.toObject();
    const publicOrder = plainToInstance(OrderRestaurantOutputDto, orderObject, {
      excludeExtraneousValues: true,
    });

    try {
      const client = await this.clientModel.findOne({
        _id: new Types.ObjectId(order.client.toString()),
      });
      const userId = client?.user.toString();

      if (!userId) {
        this.logger.warn(
          `[cancelOrderRestaurant] No user ID found for client ${order.client} to send notification`,
        );
        return;
      }
      this.logger.log(`[cancelOrderRestaurant] User ID to notify: ${userId}`);

      const orderToSendToClient = plainToInstance(
        OrderClientOutputDto,
        orderObject,
        {
          excludeExtraneousValues: true,
        },
      );
      this.eventsGateway.emitToUser<OrderClientOutputDto>(
        userId,
        EnumWebSocketEventType.ORDER_CANCELLED,
        orderToSendToClient,
      );
    } catch (error) {
      this.logger.error(
        `[cancelOrderRestaurant] Failed to emit order created event: ${error.message}`,
      );
    }

    return OrchestrationResult.Success<OrderRestaurantOutputDto>({
      statusCode: EnumStatusCode.CANCELLED_SUCCESSFULLY,
      data: publicOrder,
      message: 'Order cancelled successfully',
    });
  }

  async updateOrderStatus({
    orderId,
    user,
    status,
  }: {
    orderId: string;
    status: EnumOrderStatus;
    user: ILoggedInUserTokenData;
  }) {
    this.logger.log(
      `[updateOrderStatus] Order status update request by restaurantId=${user.restaurantId} for orderId=${orderId}, status=${status}`,
    );

    const validOrderTransitions = [
      [EnumOrderStatus.PAID, EnumOrderStatus.PREPARING_ORDER],
      [EnumOrderStatus.PAID, EnumOrderStatus.IN_DELIVERY],
      [EnumOrderStatus.PAID, EnumOrderStatus.DELIVERED],
      [EnumOrderStatus.PREPARING_ORDER, EnumOrderStatus.IN_DELIVERY],
      [EnumOrderStatus.PREPARING_ORDER, EnumOrderStatus.DELIVERED],
      [EnumOrderStatus.IN_DELIVERY, EnumOrderStatus.DELIVERED],
    ];

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      restaurant: new Types.ObjectId(user.restaurantId),
    });

    if (!order) {
      this.logger.warn(
        `[updateOrderStatus] Order not found or access denied: orderId=${orderId}, restaurantId=${user.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_NOT_FOUND,
        message: 'Order not found',
        code: 404,
      });
    }

    const canTransitionStatus = validOrderTransitions.some(
      ([from, to]) => from === order.status && to === status,
    );

    if (!canTransitionStatus) {
      this.logger.warn(
        `[updateOrderStatus] Invalid order status transition: orderId=${orderId}, currentStatus=${order.status}, targetStatus=${status}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_STATUS_TRANSITION,
        message: 'Invalid order status transition',
        code: 400,
      });
    }

    this.logger.log(
      `[updateOrderStatus] Updating order status: id=${order._id}, restaurantId=${user.restaurantId}, status=${status}`,
    );

    order.status = status;
    order.statusTransitions = [
      ...order.statusTransitions,
      {
        status: status,
        timestamp: new Date(),
      },
    ];

    await order.save();

    this.logger.log(
      `[updateOrderStatus] Order status updated successfully: id=${order._id}, status=${order.status}`,
    );

    const orderObject = order.toObject();
    const publicOrder = plainToInstance(OrderRestaurantOutputDto, orderObject, {
      excludeExtraneousValues: true,
    });

    try {
      const client = await this.clientModel.findOne({
        _id: new Types.ObjectId(order.client.toString()),
      });
      const userId = client?.user.toString();

      if (!userId) {
        this.logger.warn(
          `[updateOrderStatus] No user ID found for client ${order.client} to send notification`,
        );
        return;
      }
      this.logger.log(`[updateOrderStatus] User ID to notify: ${userId}`);

      const orderToSendToClient = plainToInstance(
        OrderClientOutputDto,
        orderObject,
        {
          excludeExtraneousValues: true,
        },
      );
      this.eventsGateway.emitToUser<OrderClientOutputDto>(
        userId,
        EnumWebSocketEventType.ORDER_STATUS_CHANGED,
        orderToSendToClient,
      );
    } catch (error) {
      this.logger.error(
        `[updateOrderStatus] Failed to emit order created event: ${error.message}`,
      );
    }

    return OrchestrationResult.Success<OrderRestaurantOutputDto>({
      statusCode: EnumStatusCode.CANCELLED_SUCCESSFULLY,
      data: publicOrder,
      message: 'Order status updated successfully',
    });
  }

  async getOrderClient(orderId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[getOrderClient] Fetching client for orderId=${orderId}, restaurantId=${user.restaurantId}`,
    );

    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        restaurant: new Types.ObjectId(user.restaurantId),
      })
      .populate({
        path: 'client',
        populate: {
          path: 'user',
        },
      });

    if (!order) {
      this.logger.warn(
        `[getOrderClient] Order not found or access denied: orderId=${orderId}, restaurantId=${user.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_NOT_FOUND,
        message: 'Order not found',
        code: 404,
      });
    }

    const client = order.client as ClientDocument;
    if (!client) {
      this.logger.warn(
        `[getOrderClient] Client not found for order: orderId=${orderId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CLIENT_NOT_FOUND,
        message: 'Client not found',
        code: 404,
      });
    }

    this.logger.log(
      `[getOrderClient] Client found for order: orderId=${orderId}, clientId=${client._id}`,
    );

    const clientObject = client.toObject();
    const publicClient = plainToInstance(
      ClientPublicWithUserOutputDto,
      clientObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<ClientPublicWithUserOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicClient,
      message: 'Order client fetched successfully',
    });
  }

  async pay(orderId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[pay] Payment request by clientId=${user.clientId} for orderId=${orderId}`,
    );

    // Find the order by id and client id
    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      client: new Types.ObjectId(user.clientId),
    });

    if (!order) {
      this.logger.warn(
        `[pay] Order not found or access denied: orderId=${orderId}, clientId=${user.clientId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_NOT_FOUND,
        message: 'Order not found',
        code: 404,
      });
    }

    if (order.status !== EnumOrderStatus.CREATED) {
      this.logger.warn(
        `[pay] Order cannot be paid - invalid status: orderId=${orderId}, currentStatus=${order.status}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.ORDER_CANNOT_BE_PAID,
        message: 'Order can only be paid when in CREATED status',
        code: 400,
      });
    }

    if (order.maxTimeToPayOrder && new Date() > order.maxTimeToPayOrder) {
      this.logger.warn(
        `[pay] Order payment deadline has passed: orderId=${orderId}, maxTimeToPayOrder=${order.maxTimeToPayOrder.toISOString()}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.PAYMENT_TIME_EXPIRED,
        message: 'Order payment deadline has passed',
        code: 400,
      });
    }

    const client = await this.clientModel
      .findById(order.client)
      .populate('user');

    if (!client) {
      this.logger.warn(
        `[pay] Client with id ${order.client.toString()} does not exist`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CLIENT_NOT_FOUND,
        message: 'Client does not exist.',
        code: 404,
      });
    }

    this.logger.log(`[pay] Proceeding to create charge for order ${orderId}`);

    const flutterwavePayment = await this.flutterwaveService.createPayment({
      tx_ref: order.id.toString(),
      session_duration: env.flutterWaveMaxPaymentLinkValidityInHr * 60,
      amount: order.pricing.totalAmountCollectedWithDelivery.toString(),
      currency: EnumCurrency.XAF,
      customer: {
        email: (client.user as UserDocument).email,
        name: (client.user as UserDocument).fullName,
      },
      customizations: {
        title: 'Chopme',
      },
      redirect_url: `${env.flutterWaveRedirectUrl}?orderId=${order.id}`,
      meta: {
        orderId: order.id.toString(),
      },
    });

    order.status = EnumOrderStatus.PAYMENT_INITIATED;
    order.paymentDetails = {
      link: flutterwavePayment.link,
      validUntil: new Date(
        Date.now() + env.flutterWaveMaxPaymentLinkValidityInHr * 60 * 60 * 1000,
      ),
    };
    order.statusTransitions = [
      ...order.statusTransitions,
      { status: EnumOrderStatus.PAYMENT_INITIATED, timestamp: new Date() },
    ];

    await order.save();

    return OrchestrationResult.Success<{
      url: string;
    }>({
      statusCode: EnumStatusCode.PAYMENT_INITIATED,
      data: {
        url: flutterwavePayment.link,
      },
      message: 'Payment flow initialized',
    });
  }
}
