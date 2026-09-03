import { Injectable, Logger } from '@nestjs/common';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Transfer, TransferDocument } from './entities/transfer.entity';
import { Connection, Model, Types } from 'mongoose';
import { Order, OrderDocument } from 'src/orders/entities/order.entity';
import { TransferPublicOutputDto } from './dto/output/transfer-output.dto';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { plainToInstance } from 'class-transformer';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import Flutterwave from 'flutterwave-node-v3';
import { env } from 'src/config/env';
import { EnumCurrency } from 'src/common/enums/currencies';
import {
  Restaurant,
  RestaurantDocument,
} from 'src/restaurants/entities/restaurant.entity';
import { FlutterWaveResponse } from 'src/common/interfaces/flutterwave/response';
import {
  FlutterwaveBulkTransfer,
  FlutterwaveBulkTransferMetaData,
  FlutterwaveTransfer,
} from 'src/common/interfaces/flutterwave/transfer';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';
import { Pagination } from 'src/common/interfaces/pagination';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);
  private readonly flw = new Flutterwave(
    env.flutterWaveClientPublicKey,
    env.flutterWaveClientSecretKey,
  );

  constructor(
    @InjectModel(Transfer.name)
    private readonly transferModel: Model<TransferDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async create(user: ILoggedInUserTokenData) {
    this.logger.log(
      `[createTransfer] Initiating transfer creation by userId=${user.id}, restaurantId=${user.restaurantId}`,
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.warn(
        `[createTransfer] Restaurant not found or is deleted: restaurantId=${user.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RESTAURANT_NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (!restaurant?.wallet || !restaurant.wallet?.mobileData) {
      this.logger.log(
        `[createTransfer] Restaurant wallet or mobile data not found for restaurantId=${user.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NO_WALLET,
        message: 'Restaurant wallet not found',
        code: 404,
      });
    }

    const restaurantId = new Types.ObjectId(user.restaurantId);

    this.logger.log(
      `[createTransfer] Fetching delivered orders without transfer for restaurantId=${user.restaurantId}`,
    );

    const orders = await this.orderModel
      .find({
        status: EnumOrderStatus.DELIVERED,
        transfer: { $exists: false },
        restaurant: restaurantId,
      })
      .exec();

    this.logger.log(
      `[createTransfer] Found ${orders.length} eligible order(s) for transfer`,
    );

    if (orders.length === 0) {
      this.logger.warn(
        `[createTransfer] No eligible orders found for restaurantId=${user.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_CREATE_TRANSFER,
        message: 'No eligible orders found for transfer',
        code: 400,
      });
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    let transfer: TransferDocument | null = null;

    try {
      const totalRestaurantAmount = orders.reduce(
        (acc, order) => acc + order.pricing.restaurantAmountWithDelivery,
        0,
      );
      const totalPlatformAmount = orders.reduce(
        (acc, order) => acc + order.pricing.platformEarningsAmount,
        0,
      );

      this.logger.log(
        `[createTransfer] Computed amounts: totalRestaurantAmount=${totalRestaurantAmount}, totalPlatformAmount=${totalPlatformAmount}`,
      );

      transfer = new this.transferModel({
        restaurant: restaurantId,
        totalRestaurantAmount,
        totalPlatformAmount,
        totalOrders: orders.length,
        createdBy: new Types.ObjectId(user.id),
      });
      await transfer.save({ session });

      this.logger.log(
        `[createTransfer] Transfer document saved: id=${transfer._id}, restaurantId=${user.restaurantId}`,
      );

      const orderIds = orders.map((o) => o._id);
      await this.orderModel.updateMany(
        {
          _id: { $in: orderIds },
        },
        {
          $set: {
            transfer: transfer._id,
          },
        },
        { session },
      );

      this.logger.log(
        `[createTransfer] Linked ${orderIds.length} order(s) to transfer: id=${transfer._id}`,
      );

      await session.commitTransaction();
      this.logger.log(
        `[createTransfer] Transaction committed successfully: transferId=${transfer._id}`,
      );
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[createTransfer] Error during transfer creation: ${error?.message}`,
        error?.stack,
      );

      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_CREATE_TRANSFER,
        message: 'Unable to create transfer',
        code: 500,
      });
    } finally {
      session.endSession();
    }

    if (transfer) {
      try {
        this.logger.log(
          `[createTransfer] Starting transfer initiation: transferId=${transfer._id}`,
        );

        await this.initiateTransfer(transfer, restaurant);
      } catch (error) {
        this.logger.error(
          `[createTransfer] Failed to initiate transfer: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `[createTransfer] Transfer creation completed: transferId=${transfer?._id}`,
    );

    if (!transfer) {
      this.logger.error('[createTransfer] Transfer is unexpectedly null');
      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_CREATE_TRANSFER,
        message: 'Unable to create transfer',
        code: 500,
      });
    }

    const publicTransfer = plainToInstance(
      TransferPublicOutputDto,
      transfer.toObject(),
      { excludeExtraneousValues: true },
    );

    return OrchestrationResult.Success<TransferPublicOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicTransfer,
      message: 'Transfer created successfully',
    });
  }

  async getRestaurantTransfers({
    user,
    page,
    limit,
    status,
  }: {
    user: ILoggedInUserTokenData;
    page: number;
    limit: number;
    status?: EnumTransferStatuses;
  }) {
    this.logger.log(
      `[getRestaurantTransfers] Fetching transfers for restaurantId=${user.restaurantId}, page=${page}, limit=${limit}, status=${status}`,
    );

    if (status && !Object.values(EnumTransferStatuses).includes(status)) {
      this.logger.warn(`[getRestaurantTransfers] Invalid status: ${status}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CANNOT_FILTER_WITH_STATUS,
        message: `Cannot filter with status ${status}`,
        code: 400,
      });
    }

    const restaurantId = new Types.ObjectId(user.restaurantId);
    const filters: {
      restaurant: Types.ObjectId;
      status?: EnumTransferStatuses;
      deleted: boolean;
    } = { restaurant: restaurantId, deleted: false };

    if (status) {
      filters.status = status;
    }

    const totalItems = await this.transferModel.countDocuments(filters);
    const transfers = await this.transferModel
      .find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalItems / limit) || 1;
    const publicTransfers = plainToInstance(
      TransferPublicOutputDto,
      transfers.map((transfer) => transfer.toObject()),
      { excludeExtraneousValues: true },
    );

    const paginatedResult: Pagination<TransferPublicOutputDto> = {
      items: publicTransfers,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<TransferPublicOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Restaurant transfers fetched successfully',
    });
  }

  async startTransfer({
    transferId,
    user,
  }: {
    transferId: string;
    user: ILoggedInUserTokenData;
  }) {
    this.logger.log('[startTransfer] Starting transfer initiation');
    const transfer = await this.transferModel.findById(transferId);
    if (!transfer) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Transfer not found',
        code: 404,
      });
    }
    if (
      transfer.status !== EnumTransferStatuses.CREATED &&
      transfer.status !== EnumTransferStatuses.FAILED_TO_INITIATE
    ) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_START_TRANSFER,
        message: 'Transfer cannot be initiated',
        code: 400,
      });
    }
    const restaurant = await this.restaurantModel.findById(transfer.restaurant);

    if (!restaurant) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    await this.initiateTransfer(transfer, restaurant);

    const publicTransfer = plainToInstance(
      TransferPublicOutputDto,
      transfer.toObject(),
      { excludeExtraneousValues: true },
    );

    return OrchestrationResult.Success<TransferPublicOutputDto>({
      statusCode: EnumStatusCode.STARTED_SUCCESSFULLY,
      data: publicTransfer,
      message: 'Transfer started successfully',
    });
  }

  async initiateTransfer(
    transfer: TransferDocument,
    restaurant: RestaurantDocument,
  ) {
    this.logger.log('[initiateTransfer] Starting transfer initiation');

    const restaurantTransferMetaData: FlutterwaveBulkTransferMetaData = {
      transferId: transfer._id.toString(),
      direction: 'restaurant',
    };

    const platformTransferMetaData: FlutterwaveBulkTransferMetaData = {
      transferId: transfer._id.toString(),
      direction: 'platform',
    };

    const details = {
      title: 'Staff salary for April',
      bulk_data: [
        {
          account_bank: restaurant.wallet?.mobileData?.network || '',
          account_number: restaurant.wallet?.mobileData?.number || '',
          amount: transfer.totalRestaurantAmount,
          currency: EnumCurrency.XAF,
          beneficiary_name: restaurant?.name || '',
          meta: restaurantTransferMetaData,
        },
        {
          account_bank: env.platformMobileMoneyNetworkType,
          account_number: env.platformMobileMoneyAccountNumber,
          amount: transfer.totalPlatformAmount,
          currency: EnumCurrency.XAF,
          beneficiary_name: `ChopMe Platform for restaurant ${restaurant?.name}`,
          meta: platformTransferMetaData,
        },
      ],
    };

    const response = (await this.flw.Transfer.bulk(
      details,
    )) as FlutterWaveResponse<FlutterwaveBulkTransfer>;

    this.logger.log(
      `[initiateTransfer] Transfer response: ${JSON.stringify(response)}`,
    );

    if (response.status === 'success') {
      this.logger.log('[initiateTransfer] Transfer initiated successfully');
      transfer.transferId = response.data.id;
      transfer.status = EnumTransferStatuses.INITIATED;
      transfer.restaurantTransferStatus = EnumTransferStatuses.INITIATED;
      transfer.platformTransferStatus = EnumTransferStatuses.INITIATED;
      await transfer.save();
    } else {
      this.logger.log('[initiateTransfer] Transfer failed to initiate');
      transfer.status = EnumTransferStatuses.FAILED_TO_INITIATE;
      await transfer.save();
    }
  }
}
