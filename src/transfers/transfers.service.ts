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
import { env } from 'src/config/env';
import {
  Restaurant,
  RestaurantDocument,
} from 'src/restaurants/entities/restaurant.entity';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';
import { Pagination } from 'src/common/interfaces/pagination';
import { TranzakService } from 'src/common/tranzak/tranzak.service';
import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTransferDirection } from 'src/common/enums/transfer-direction';
import {
  ITranzakCreateTopupRequestDto,
  ITranzakCreateTopupResponseData,
} from 'src/common/interfaces/tranzak/topup';
import { EnumTranzakTopupStatus } from 'src/common/enums/tranzak/topup-status';
import {
  TransferGroup,
  TransferGroupDocument,
} from './entities/transfer-group.entity';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);
  constructor(
    @InjectModel(Transfer.name)
    private readonly transferModel: Model<TransferDocument>,
    @InjectModel(TransferGroup.name)
    private readonly transferGroupModel: Model<TransferGroupDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly tranzakService: TranzakService,
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
        transferGroup: { $exists: false },
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

    let restaurantTransfer: TransferDocument | null = null;
    let platformTransfer: TransferDocument | null = null;
    let transferGroup: TransferGroupDocument | null = null;

    try {
      const totalRestaurantAmount = orders.reduce(
        (acc, order) => acc + order.pricing.restaurantAmountWithDelivery,
        0,
      );
      const totalPlatformAmount = orders.reduce(
        (acc, order) => acc + order.pricing.platformEarningsAmount,
        0,
      );
      const totalTopupAmount = orders.reduce(
        (acc, order) =>
          acc + (order.paymentWebhookDetails?.netAmountReceived ?? 0),
        0,
      );

      const totalAmount = totalRestaurantAmount + totalPlatformAmount;

      this.logger.log(
        `[createTransfer] Computed amounts: totalRestaurantAmount=${totalRestaurantAmount}, totalPlatformAmount=${totalPlatformAmount}, totalAmount=${totalAmount}, totalTopupAmount=${totalTopupAmount}`,
      );

      transferGroup = new this.transferGroupModel({
        restaurantAmount: totalRestaurantAmount,
        platformAmount: totalPlatformAmount,
        totalAmount,
        totalTopupAmount,
        transfers: [],
        createdBy: new Types.ObjectId(user.id),
      });
      await transferGroup.save({ session });

      restaurantTransfer = new this.transferModel({
        restaurant: restaurantId,
        amount: totalRestaurantAmount,
        totalOrders: orders.length,
        transferGroup: transferGroup._id,
        transferDirection: EnumTransferDirection.RESTAURANT,
        createdBy: new Types.ObjectId(user.id),
      });
      await restaurantTransfer.save({ session });

      platformTransfer = new this.transferModel({
        restaurant: restaurantId,
        amount: totalPlatformAmount,
        totalOrders: orders.length,
        transferGroup: transferGroup._id,
        transferDirection: EnumTransferDirection.PLATFORM,
        createdBy: new Types.ObjectId(user.id),
      });
      await platformTransfer.save({ session });

      await this.transferGroupModel.updateOne(
        { _id: transferGroup._id },
        { transfers: [restaurantTransfer._id, platformTransfer._id] },
        { session },
      );

      this.logger.log(
        `[createTransfer] Transfer documents saved: restaurantTransferId=${restaurantTransfer._id}, platformTransferId=${platformTransfer._id}, transferGroupId=${transferGroup._id}`,
      );

      const orderIds = orders.map((o) => o._id);
      await this.orderModel.updateMany(
        {
          _id: { $in: orderIds },
        },
        {
          $set: {
            transferGroup: transferGroup._id,
          },
        },
        { session },
      );

      this.logger.log(
        `[createTransfer] Linked ${orderIds.length} order(s) to transferGroup=${transferGroup._id}`,
      );

      await session.commitTransaction();
      this.logger.log(
        `[createTransfer] Transaction committed successfully: transferGroup=${transferGroup._id}`,
      );
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
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

    if (!restaurantTransfer || !platformTransfer || !transferGroup) {
      this.logger.error('[createTransfer] Transfer is unexpectedly null');
      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_CREATE_TRANSFER,
        message: 'Unable to create transfer',
        code: 500,
      });
    }

    try {
      this.logger.log(
        `[createTransfer] Ensuring topup for transferGroup=${transferGroup._id}`,
      );

      const ensuredTransferGroupTopup = await this.ensureTopup(
        transferGroup._id,
      );

      this.logger.log(
        `[createTransfer] Topup ensured with status=${ensuredTransferGroupTopup.topupStatus}`,
      );

      if (
        ensuredTransferGroupTopup.topupStatus ===
        EnumTranzakTopupStatus.SUCCESSFUL
      ) {
        this.logger.log(
          `[createTransfer] Topup successful, starting transfer initiation: restaurantTransferId=${restaurantTransfer._id}, platformTransferId=${platformTransfer._id}`,
        );

        await this.initiateTransfer(restaurantTransfer, restaurant);
        await this.initiateTransfer(platformTransfer, restaurant);
      } else {
        this.logger.warn(
          `[createTransfer] Topup not successful (status=${ensuredTransferGroupTopup.topupStatus}), skipping transfer initiation`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[createTransfer] Failed to initiate transfer: ${error.message}`,
      );
    }

    this.logger.log(
      `[createTransfer] Transfer creation completed: transferGroup=${transferGroup?._id}`,
    );

    const publicTransfer = plainToInstance(
      TransferPublicOutputDto,
      restaurantTransfer.toObject(),
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
      transferDirection: EnumTransferDirection;
    } = {
      restaurant: restaurantId,
      deleted: false,
      transferDirection: EnumTransferDirection.RESTAURANT,
    };

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
  }: {
    transferId: string;
    user: ILoggedInUserTokenData;
  }) {
    this.logger.log(
      `[startTransfer] Starting transfer initiation for transferId=${transferId}`,
    );

    const transfer = await this.transferModel.findById(transferId);
    if (!transfer) {
      this.logger.error(
        `[startTransfer] Transfer not found: transferId=${transferId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Transfer not found',
        code: 404,
      });
    }

    this.logger.log(
      `[startTransfer] Transfer found: transferId=${transfer._id}, status=${transfer.status}`,
    );

    if (
      transfer.status !== EnumTransferStatuses.CREATED &&
      transfer.status !== EnumTransferStatuses.FAILED_TO_INITIATE
    ) {
      this.logger.warn(
        `[startTransfer] Transfer cannot be initiated: transferId=${transfer._id}, currentStatus=${transfer.status}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_START_TRANSFER,
        message: 'Transfer cannot be initiated',
        code: 400,
      });
    }

    const restaurant = await this.restaurantModel.findById(transfer.restaurant);

    if (!restaurant) {
      this.logger.error(
        `[startTransfer] Restaurant not found: restaurantId=${transfer.restaurant}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    this.logger.log(
      `[startTransfer] Restaurant found: restaurantId=${restaurant._id}, name=${restaurant.name}`,
    );

    // Ensure topup before initiating transfer
    this.logger.log(
      `[startTransfer] Ensuring topup for transferGroup=${transfer.transferGroup}`,
    );

    const ensuredTransferGroupTopup = await this.ensureTopup(
      transfer.transferGroup as Types.ObjectId,
    );

    this.logger.log(
      `[startTransfer] Topup ensured with status=${ensuredTransferGroupTopup.topupStatus}`,
    );

    if (
      ensuredTransferGroupTopup.topupStatus !==
      EnumTranzakTopupStatus.SUCCESSFUL
    ) {
      this.logger.warn(
        `[startTransfer] Topup not successful (status=${ensuredTransferGroupTopup.topupStatus}), cannot initiate transfer`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_START_TRANSFER,
        message: `Cannot initiate transfer: topup status is ${ensuredTransferGroupTopup.topupStatus}`,
        code: 400,
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
    this.logger.log(
      `[initiateTransfer] Starting transfer initiation: transferId=${transfer._id}, direction=${transfer.transferDirection}`,
    );

    try {
      if (transfer.transferDirection === EnumTransferDirection.RESTAURANT) {
        const response = await this.tranzakService.createTransfer({
          amount: transfer.amount,
          currencyCode: EnumTranzakCurrency.XAF,
          description: `Order earnings payout for restaurant ${restaurant?.name || ''}`,
          customTransactionRef: `${transfer._id}`,
          payeeAccountId: restaurant.wallet?.mobileData?.number || '',
          payeeAccountName: restaurant?.name || '',
          payeeNote: 'Order earnings',
        });

        this.logger.log(
          `[initiateTransfer] Restaurant transfer initiated: transferId=${response.transferId}, status=${response.status}`,
        );

        transfer.transferId = response.transferId;
      } else if (
        transfer.transferDirection === EnumTransferDirection.PLATFORM
      ) {
        const response = await this.tranzakService.createTransfer({
          amount: transfer.amount,
          currencyCode: EnumTranzakCurrency.XAF,
          description: `Platform earnings from restaurant ${restaurant?.name || ''}`,
          customTransactionRef: `${transfer._id}`,
          payeeAccountId: env.platformMobileMoneyAccountNumber,
          payeeAccountName: 'ChopMe Platform',
          payeeNote: 'Platform commission',
        });

        this.logger.log(
          `[initiateTransfer] Platform transfer initiated: transferId=${response.transferId}, status=${response.status}`,
        );

        transfer.transferId = response.transferId;
      }

      transfer.status = EnumTransferStatuses.INITIATED;
      await transfer.save();
    } catch (error) {
      this.logger.error(
        `[initiateTransfer] Tranzak transfer failed: transferId=${transfer._id}`,
        error.response?.data || error.message,
      );
      transfer.status = EnumTransferStatuses.FAILED_TO_INITIATE;
      await transfer.save();
    }
  }

  async ensureTopup(
    transferGroupId: Types.ObjectId,
  ): Promise<TransferGroupDocument> {
    this.logger.log(
      `[ensureTopup] Checking topup for transferGroupId=${transferGroupId}`,
    );

    const transferGroup =
      await this.transferGroupModel.findById(transferGroupId);

    if (!transferGroup) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Transfer group not found',
        code: 404,
      });
    }

    // Check if topup already exists and is successful or processing
    if (
      transferGroup.topupStatus &&
      transferGroup.topupStatus !== EnumTranzakTopupStatus.FAILED
    ) {
      this.logger.log(
        `[ensureTopup] Topup already exists with status=${transferGroup.topupStatus}, skipping creation`,
      );
      return transferGroup;
    }

    // Create new topup
    try {
      const topupRequest: ITranzakCreateTopupRequestDto = {
        amount: transferGroup.totalTopupAmount,
        currencyCode: EnumTranzakCurrency.XAF,
        description: 'Payout account topup',
        customTransactionRef: `${transferGroup._id}`,
        payeeNote: 'Payout account topup',
      };

      this.logger.log(
        `[ensureTopup] Creating topup: amount=${topupRequest.amount}`,
      );

      const topupResponse: ITranzakCreateTopupResponseData =
        await this.tranzakService.createTopup(topupRequest);

      this.logger.log(
        `[ensureTopup] Topup created: transferId=${topupResponse.transferId}, status=${topupResponse.status}`,
      );

      transferGroup.topupStatus = topupResponse.status;
      transferGroup.topupDetails = {
        transferId: topupResponse.transferId,
        status: topupResponse.status,
        payeeAccountId: topupResponse.payeeAccountId,
        fundingAccountId: topupResponse.fundingAccountId,
        payeeAccountName: topupResponse.payeeAccountName,
        destinationServiceName: topupResponse.destinationServiceName,
        payeeNote: topupResponse.payeeNote,
        description: topupResponse.description,
        amount: topupResponse.amount,
        currencyCode: topupResponse.currencyCode,
        fee: topupResponse.fee,
        customTransactionRef: topupResponse.customTransactionRef,
        feeIsPaidByPayee: topupResponse.feeIsPaidByPayee,
        createdByAppId: topupResponse.createdByAppId,
        payoutId: topupResponse.payoutId,
        payeeFeePercentage: topupResponse.payeeFeePercentage,
        type: topupResponse.type,
        transactionId: topupResponse.transactionId,
        transactionTime: topupResponse.transactionTime,
        partnerTransactionId: topupResponse.partnerTransactionId,
        sms: topupResponse.sms,
        verifyPayeeName: topupResponse.verifyPayeeName,
        createdAt: topupResponse.createdAt,
      };

      await transferGroup.save();

      this.logger.log(
        `[ensureTopup] Topup details saved to transferGroup=${transferGroup._id}`,
      );

      return transferGroup;
    } catch (error) {
      this.logger.error(
        `[ensureTopup] Failed to create topup: ${error.message}`,
        error,
      );

      // Save failed status if possible
      if (transferGroup) {
        transferGroup.topupStatus = EnumTranzakTopupStatus.FAILED;
        transferGroup.topupDetails = {
          status: EnumTranzakTopupStatus.FAILED,
        };
        await transferGroup.save();
      }

      throw error;
    }
  }
}
