import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOrderDto } from './dto/input/create-order.dto';
import { PayOrderDto } from './dto/input/pay-order.dto';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import {
  Client,
  ClientDocument,
  MobilePaymentMethod,
} from 'src/clients/entities/client.entity';
import {
  Restaurant,
  RestaurantDocument,
} from 'src/restaurants/entities/restaurant.entity';
import { computeDistanceBetweenTwoPoints } from 'src/common/utils/compute-distance-between-two-points';
import { env } from 'src/config/env';
import { Order, OrderDocument, OrderItem } from './entities/order.entity';
import { computePriceWithPlatformPercentage } from 'src/common/utils/compute-price-with-platform-percentage';
import { plainToInstance } from 'class-transformer';
import { OrderClientOutputDto } from './dto/output/order-output.dto';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { FlutterwaveService } from 'src/common/flutterwave/flutterwave.service';
import { UserDocument } from 'src/users/entities/user.entity';
import { CameroonPhoneUtils } from 'src/common/utils/cameroon-phone-utils';
import { EnumNetwork } from 'src/common/enums/networks';
import { EnumCurrency } from 'src/common/enums/currencies';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Menu.name) private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly flutterwaveService: FlutterwaveService,
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
      !client.phone_number
    ) {
      this.logger.warn(
        `[ensureCanOrder] Client information incomplete: clientId=${client._id}, hasAddress=${!!client.address}, hasPhone=${!!client.phone_number}`,
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

  async pay(
    orderId: string,
    user: ILoggedInUserTokenData,
    payOrderDto: PayOrderDto,
  ) {
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

    let customerId: string;
    let mobilePaymentMethodId: string;

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

    if (!client.customer_id) {
      const user = client.user as UserDocument;

      this.logger.log(
        `[create] Creating flutterwave customer_id for client id=${client._id} for user id=${user._id}`,
      );

      const flutterwaveCustomer = await this.flutterwaveService.createCustomer({
        customerData: {
          name: {
            first: user.fullName,
          },
          email: user.email,
        },
        uniqueIdentifier: client.id.toString(),
      });

      client.customer_id = flutterwaveCustomer.id;
      await client.save();

      customerId = flutterwaveCustomer.id;

      this.logger.log(
        `[create] Successfully created flutterwave customer_id for client id=${client._id}`,
      );
    } else {
      customerId = client.customer_id;
    }

    if (payOrderDto.mobileMoneyPhoneNumber) {
      this.logger.log(
        `[pay] Creating new mobile payment method for client id=${client._id} with phone number ${payOrderDto.mobileMoneyPhoneNumber}`,
      );

      const network = CameroonPhoneUtils.getOperator(
        payOrderDto.mobileMoneyPhoneNumber,
      );

      if (network === EnumNetwork.UNKNOWN) {
        this.logger.warn(
          `[pay] Mobile phone number ${payOrderDto.mobileMoneyPhoneNumber} is not valid for client ${client._id}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INVALID_PHONE_NUMBER,
          message: 'Mobile phone number is invalid',
          code: 400,
        });
      }
      this.logger.log(
        `[pay] Detected network ${network} for phone number ${payOrderDto.mobileMoneyPhoneNumber}`,
      );

      const numberWithoutPrefix = CameroonPhoneUtils.normalize(
        payOrderDto.mobileMoneyPhoneNumber,
      );
      this.logger.log(
        `[pay] Phone number without prefix for client ${client._id}: ${numberWithoutPrefix}`,
      );

      this.logger.log(
        `[pay] Calling Flutterwave to create payment method for client ${client._id}, phone number ${numberWithoutPrefix}, network ${network}`,
      );
      const flutterwavePaymentMethod =
        await this.flutterwaveService.createPaymentMethod({
          paymentMethodData: {
            type: 'mobile_money',
            mobile_money: {
              country_code: '237',
              network,
              phone_number: numberWithoutPrefix,
            },
          },
          uniqueIdentifier: client.id.toString(),
          idempotencyKey: `${client.id.toString()}-${numberWithoutPrefix}`,
        });

      this.logger.log(
        `[pay] Flutterwave payment method created with id=${flutterwavePaymentMethod.id} for client ${client._id}`,
      );

      client.mobilePaymentMethods = [
        ...client.mobilePaymentMethods,
        {
          accountNumber: numberWithoutPrefix,
          network,
          paymentMethodId: flutterwavePaymentMethod.id,
          prefix: '237',
        },
      ];
      await client.save();
      mobilePaymentMethodId = flutterwavePaymentMethod.id;

      this.logger.log(
        `[pay] Saved new mobile payment method for client ${client._id}, paymentMethodId=${mobilePaymentMethodId}`,
      );
    } else {
      this.logger.log(
        `[pay] Using existing mobile payment method ${payOrderDto.paymentMethodId} for client ${client._id}`,
      );

      const existingMobilePaymentMethod = client.mobilePaymentMethods.find(
        (item) => item.paymentMethodId === payOrderDto.paymentMethodId,
      );
      if (existingMobilePaymentMethod) {
        mobilePaymentMethodId = existingMobilePaymentMethod.paymentMethodId;
        this.logger.log(
          `[pay] Found existing mobile payment method id=${mobilePaymentMethodId} for client ${client._id}`,
        );
      } else {
        this.logger.warn(
          `[pay] Mobile payment method with id ${payOrderDto.paymentMethodId} does not exist for client ${client._id}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.MOBILE_PAYMENT_METHOD_NOT_FOUND,
          message: 'Mobile payment method does not exist.',
          code: 404,
        });
      }
    }

    this.logger.log(
      `[pay] Payment method resolved for client ${client._id}, paymentMethodId=${mobilePaymentMethodId}. Proceeding to create charge for order ${orderId}`,
    );

    const flutterwaveCharge = await this.flutterwaveService.createCharge({
      idempotencyKey: order.id.toString(),
      uniqueIdentifier: order.id.toString(),
      chargeData: {
        amount: order.pricing.totalAmountCollectedWithDelivery,
        currency: EnumCurrency.XAF,
        customer_id: customerId,
        payment_method_id: mobilePaymentMethodId,
        reference: `Order-${order.id.toString()}`,
        meta: {
          orderId: order.id.toString(),
        },
      },
    });

    order.chargeId = flutterwaveCharge.id;
    order.status = EnumOrderStatus.PAYMENT_INITIATED;
    order.statusTransitions = [
      ...order.statusTransitions,
      { status: EnumOrderStatus.PAYMENT_INITIATED, timestamp: new Date() },
    ];

    await order.save();

    const orderObject = order.toObject();
    const publicOrder = plainToInstance(OrderClientOutputDto, orderObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<OrderClientOutputDto>({
      statusCode: EnumStatusCode.PAYMENT_INITIATED,
      data: publicOrder,
      message: 'Payment flow initialized',
    });
  }
}
