import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Connection, Model, Types } from 'mongoose';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  Order,
  OrderDocument,
  PaymentWebhookDetails,
} from 'src/orders/entities/order.entity';
import {
  Refund,
  RefundDocument,
  RefundWebhookDetails,
} from 'src/orders/entities/refund.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { WebSocketService } from 'src/web-socket/web-socket-service';
import { EnumWebSocketEventType } from 'src/common/enums/web-socket-events';
import {
  OrderClientOutputDto,
  OrderRestaurantOutputDto,
} from 'src/orders/dto/output/order-output.dto';
import {
  RefundPrivateOutputDto,
  RefundPublicOutputDto,
} from 'src/orders/dto/output/refund-output.dto';
import { plainToInstance } from 'class-transformer';
import { RestaurantMember } from 'src/restaurant-members/entities/restaurant-member.entity';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { EnumNotificationType } from 'src/common/enums/notification-type';
import { INotification } from 'src/common/interfaces/notification';
import { FcmService } from 'src/fcm/fcm.service';
import {
  FcmToken,
  FcmTokenDocument,
} from 'src/fcm-tokens/entities/fcm-token.entity';
import { User } from 'src/users/entities/user.entity';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumUserLanguage } from 'src/common/enums/user-language';
import { EnumNotificationI18nType } from 'src/common/enums/notification-internationalization-type';
import { getNotificationMessage } from 'src/common/utils/get-fcm-notification-message';
import { env } from 'src/config/env';
import { ITranzakWebhookResponse } from 'src/common/interfaces/tranzak/response';
import { EnumTranzakWebhookEventType } from 'src/common/enums/tranzak/event-type';
import { ITranzakWebhookPaymentResponse } from 'src/common/interfaces/tranzak/payment';
import { ITranzakWebhookRefundResponse } from 'src/common/interfaces/tranzak/refund';
import { EnumRefundStatus } from 'src/common/enums/refund-statuses';
import { EnumTranzakWebhookStatus } from 'src/common/enums/tranzak/webhook-status';
import { ITranzakWebhookTransferResponse } from 'src/common/interfaces/tranzak/transfer';
import {
  Transfer,
  TransferDocument,
  TransferWebhookDetails,
} from 'src/transfers/entities/transfer.entity';
import {
  TransferPrivateOutputDto,
  TransferPublicOutputDto,
} from 'src/transfers/dto/output/transfer-output.dto';
import {
  TransferGroup,
  TransferGroupDocument,
} from 'src/transfers/entities/transfer-group.entity';
import { EnumTransferStatuses } from 'src/common/enums/transfer-statuses';
import { EnumTransferDirection } from 'src/common/enums/transfer-direction';
import { EnumTranzakTopupStatus } from 'src/common/enums/tranzak/topup-status';

@Injectable()
export class TranzakWebhookService {
  private readonly logger = new Logger(TranzakWebhookService.name);

  constructor(
    private readonly eventsGateway: WebSocketService,
    @InjectModel(Menu.name) private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMember>,
    private readonly fcmService: FcmService,
    @InjectModel(FcmToken.name)
    private readonly fcmTokenModel: Model<FcmTokenDocument>,
    @InjectModel(TransferGroup.name)
    private readonly transferGroupModel: Model<TransferGroupDocument>,
    @InjectModel(Transfer.name)
    private readonly transferModel: Model<TransferDocument>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async processWebhook(webhook: ITranzakWebhookResponse<unknown>) {
    this.logger.log(
      `[TranzakWebhookService] Received webhook event: ${webhook.eventType}`,
    );

    if (webhook.eventType === EnumTranzakWebhookEventType.REQUEST_COMPLETED) {
      const typedWebhook: ITranzakWebhookResponse<ITranzakWebhookPaymentResponse> =
        webhook as ITranzakWebhookResponse<ITranzakWebhookPaymentResponse>;

      this.logger.log(
        '[TranzakWebhookService] Processing payment completed webhook',
        typedWebhook.resource,
      );
      if (
        typedWebhook.resource.status === EnumTranzakWebhookStatus.SUCCESSFUL
      ) {
        await this.processSuccessfulPayment(typedWebhook);
      } else if (
        typedWebhook.resource.status === EnumTranzakWebhookStatus.FAILED
      ) {
        await this.processFailedPayment(typedWebhook);
      } else {
        this.logger.warn(
          `[TranzakWebhookService] Unhandled charge status: ${typedWebhook.resource.status}, tx_ref: ${typedWebhook.resource.mchTransactionRef}`,
        );
      }
    } else if (
      webhook.eventType === EnumTranzakWebhookEventType.TRANSFER_COMPLETED
    ) {
      const typedWebhook: ITranzakWebhookResponse<ITranzakWebhookTransferResponse> =
        webhook as ITranzakWebhookResponse<ITranzakWebhookTransferResponse>;
      this.logger.log(
        '[TranzakWebhookService] Processing transfer completed webhook',
        typedWebhook.resource,
      );

      if (typedWebhook.resource.type === 'account transfer') {
        await this.processTopupTransfer(typedWebhook);
      } else if (typedWebhook.resource.type === 'mobile money transfer') {
        if (
          typedWebhook.resource.status === EnumTranzakWebhookStatus.SUCCESSFUL
        ) {
          await this.processSuccessfulTransfer(typedWebhook);
        } else if (
          typedWebhook.resource.status === EnumTranzakWebhookStatus.FAILED
        ) {
          await this.processFailedTransfer(typedWebhook);
        } else {
          this.logger.warn(
            `[TranzakWebhookService] Unhandled transfer status: ${typedWebhook.resource.status}, tx_ref: ${typedWebhook.resource.customTransactionRef}`,
          );
        }
      } else {
        this.logger.warn(
          `[TranzakWebhookService] Ignoring unsupported transfer webhook event type: ${typedWebhook.resource.type}`,
        );
      }
    } else if (
      webhook.eventType === EnumTranzakWebhookEventType.REFUND_COMPLETED
    ) {
      const typedWebhook: ITranzakWebhookResponse<ITranzakWebhookRefundResponse> =
        webhook as ITranzakWebhookResponse<ITranzakWebhookRefundResponse>;
      this.logger.log(
        '[TranzakWebhookService] Processing refund completed webhook',
        typedWebhook.resource,
      );

      if (
        typedWebhook.resource.status === EnumTranzakWebhookStatus.SUCCESSFUL
      ) {
        await this.processSuccessfulRefund(typedWebhook);
      } else if (
        typedWebhook.resource.status === EnumTranzakWebhookStatus.FAILED
      ) {
        await this.processFailedRefund(typedWebhook);
      } else {
        this.logger.warn(
          `[TranzakWebhookService] Unhandled refund status: ${typedWebhook.resource.status}, tx_ref: ${typedWebhook.resource.refundedTransactionId}`,
        );
      }
    } else {
      this.logger.warn(
        `[TranzakWebhookService] Ignoring unsupported webhook event: ${webhook.eventType}`,
      );
    }

    this.logger.log('[TranzakWebhookService] Webhook processing completed');
    return 'Webhook processed successfully';
  }

  private async processSuccessfulPayment(
    webhook: ITranzakWebhookResponse<ITranzakWebhookPaymentResponse>,
  ) {
    const webhookData: ITranzakWebhookPaymentResponse = webhook.resource;

    this.logger.log(
      `[TranzakWebhookService] Processing successful payment for mchTransactionRef: ${webhookData.mchTransactionRef}, amount: ${webhookData.amount} ${webhookData.currencyCode}`,
    );

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(webhookData.mchTransactionRef),
    });

    if (!order) {
      this.logger.error(
        `[TranzakWebhookService] Order not found for mchTransactionRef: ${webhookData.mchTransactionRef}`,
      );
      throw new NotFoundException('Order not found');
    }

    this.logger.log(
      `[TranzakWebhookService] Order found: id=${order._id}, currentStatus=${order.status}`,
    );

    if (order.status !== EnumOrderStatus.PAYMENT_INITIATED) {
      this.logger.warn(
        `[TranzakWebhookService] Order already processed, skipping. id=${order._id}, status=${order.status}, mchTransactionRef: ${webhookData.mchTransactionRef}`,
      );
      return;
    }

    this.logger.log(
      `[TranzakWebhookService] Updating order status to PAID: id=${order._id}`,
    );

    order.status = EnumOrderStatus.PAID;
    order.statusTransitions = [
      ...order.statusTransitions,
      {
        status: EnumOrderStatus.PAID,
        timestamp: new Date(),
      },
    ];
    order.paidAt = new Date();
    order.paymentWebhookDetails = this.buildPaymentWebhookDetails(webhook);

    this.logger.log(
      `[TranzakWebhookService] Saving order after successful payment: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[TranzakWebhookService] Order saved successfully: id=${order._id}, status=${order.status}`,
    );

    this.logger.log(
      `[TranzakWebhookService] Triggering background menu ordersCount update for order: id=${order._id}`,
    );

    // Fire-and-forget: these are non-critical side effects and should not
    // delay the webhook response.
    this.incrementMenuOrdersCount(order).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to increment menu ordersCount for order: id=${order._id}`,
        error.message,
      );
    });

    this.notifyPaymentSuccess(order).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit payment success notifications for order: id=${order._id}`,
        error.message,
      );
    });
  }

  private async processFailedPayment(
    webhook: ITranzakWebhookResponse<ITranzakWebhookPaymentResponse>,
  ) {
    const webhookData: ITranzakWebhookPaymentResponse = webhook.resource;

    this.logger.log(
      `[TranzakWebhookService] Processing failed payment for mchTransactionRef: ${webhookData.mchTransactionRef}, amount: ${webhookData.amount} ${webhookData.currencyCode}`,
    );

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(webhookData.mchTransactionRef),
    });

    if (!order) {
      this.logger.error(
        `[TranzakWebhookService] Order not found for mchTransactionRef: ${webhookData.mchTransactionRef}`,
      );
      throw new NotFoundException('Order not found');
    }

    this.logger.log(
      `[TranzakWebhookService] Order found: id=${order._id}, currentStatus=${order.status}`,
    );

    if (order.status !== EnumOrderStatus.PAYMENT_INITIATED) {
      this.logger.warn(
        `[TranzakWebhookService] Order already processed, skipping. id=${order._id}, status=${order.status}, mchTransactionRef: ${webhookData.mchTransactionRef}`,
      );
      return;
    }

    this.logger.log(
      `[TranzakWebhookService] Updating order status to PAYMENT_FAILED: id=${order._id}`,
    );

    order.status = EnumOrderStatus.PAYMENT_FAILED;
    order.statusTransitions = [
      ...order.statusTransitions,
      {
        status: EnumOrderStatus.PAYMENT_FAILED,
        timestamp: new Date(),
      },
    ];
    order.failedPaymentAt = new Date();
    order.paymentWebhookDetails = this.buildPaymentWebhookDetails(webhook);

    this.logger.log(
      `[TranzakWebhookService] Saving order after failed payment: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[TranzakWebhookService] Order saved successfully: id=${order._id}, status=${order.status}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyPaymentFailure(order).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit payment failure notification for order: id=${order._id}`,
        error.message,
      );
    });
  }

  private async processSuccessfulRefund(
    webhook: ITranzakWebhookResponse<ITranzakWebhookRefundResponse>,
  ) {
    const webhookData: ITranzakWebhookRefundResponse = webhook.resource;

    this.logger.log(
      `[TranzakWebhookService] Processing successful refund: refundId=${webhookData.refundId}, refundedTransactionId=${webhookData.refundedTransactionId}, amount=${webhookData.amount} ${webhookData.currencyCode}`,
    );

    const refund = await this.findRefund(webhookData);

    if (!refund) {
      this.logger.error(
        `[TranzakWebhookService] Refund not found: refundId=${webhookData.refundId}, merchantRefundRef=${webhookData.merchantRefundRef}, refundedTransactionId=${webhookData.refundedTransactionId}`,
      );
      throw new NotFoundException('Refund not found');
    }

    this.logger.log(
      `[TranzakWebhookService] Refund found: id=${refund._id}, status=${refund.status}`,
    );

    if (refund.status === EnumRefundStatus.SUCCESSFUL) {
      this.logger.warn(
        `[TranzakWebhookService] Refund already processed, skipping. id=${refund._id}, status=${refund.status}`,
      );
      return;
    }

    this.logger.log(
      `[TranzakWebhookService] Updating refund status to SUCCESSFUL: id=${refund._id}`,
    );

    refund.status = EnumRefundStatus.SUCCESSFUL;
    refund.refundWebhookDetails = this.buildRefundWebhookDetails(webhook);

    this.logger.log(
      `[TranzakWebhookService] Saving refund after successful refund: id=${refund._id}`,
    );
    await refund.save();
    this.logger.log(
      `[TranzakWebhookService] Refund saved successfully: id=${refund._id}, status=${refund.status}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyRefundSuccess(refund).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit refund success notification for refund: id=${refund._id}`,
        error.message,
      );
    });
  }

  private async processFailedRefund(
    webhook: ITranzakWebhookResponse<ITranzakWebhookRefundResponse>,
  ) {
    const webhookData: ITranzakWebhookRefundResponse = webhook.resource;

    this.logger.log(
      `[TranzakWebhookService] Processing failed refund: refundId=${webhookData.refundId}, refundedTransactionId=${webhookData.refundedTransactionId}, amount=${webhookData.amount} ${webhookData.currencyCode}`,
    );

    const refund = await this.findRefund(webhookData);

    if (!refund) {
      this.logger.error(
        `[TranzakWebhookService] Refund not found: refundId=${webhookData.refundId}, merchantRefundRef=${webhookData.merchantRefundRef}, refundedTransactionId=${webhookData.refundedTransactionId}`,
      );
      throw new NotFoundException('Refund not found');
    }

    this.logger.log(
      `[TranzakWebhookService] Refund found: id=${refund._id}, status=${refund.status}`,
    );

    if (
      refund.status === EnumRefundStatus.FAILED ||
      refund.status === EnumRefundStatus.SUCCESSFUL
    ) {
      this.logger.warn(
        `[TranzakWebhookService] Refund already processed, skipping. id=${refund._id}, status=${refund.status}`,
      );
      return;
    }

    this.logger.log(
      `[TranzakWebhookService] Updating refund status to FAILED: id=${refund._id}`,
    );

    refund.status = EnumRefundStatus.FAILED;
    refund.refundWebhookDetails = this.buildRefundWebhookDetails(webhook);

    this.logger.log(
      `[TranzakWebhookService] Saving refund after failed refund: id=${refund._id}`,
    );
    await refund.save();
    this.logger.log(
      `[TranzakWebhookService] Refund saved successfully: id=${refund._id}, status=${refund.status}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyRefundFailure(refund).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit refund failure notification for refund: id=${refund._id}`,
        error.message,
      );
    });
  }

  private async processSuccessfulTransfer(
    webhook: ITranzakWebhookResponse<ITranzakWebhookTransferResponse>,
  ) {
    const webhookData = webhook.resource;

    this.logger.log(
      `[processSuccessfulTransfer] Processing: transferId=${webhookData.transferId}, ref=${webhookData.customTransactionRef}`,
    );

    const transfer = await this.transferModel.findOne({
      _id: webhookData.customTransactionRef,
      deleted: false,
    });

    if (!transfer) {
      this.logger.error(
        `[processSuccessfulTransfer] Transfer not found: id=${webhookData.customTransactionRef}`,
      );
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status === EnumTransferStatuses.COMPLETED) {
      this.logger.warn(
        `[processSuccessfulTransfer] Transfer already completed, skipping. id=${transfer._id}`,
      );
      return;
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      transfer.status = EnumTransferStatuses.COMPLETED;
      transfer.transferWebhookDetails =
        this.buildTransferWebhookDetails(webhook);
      await transfer.save({ session });

      this.logger.log(
        `[processSuccessfulTransfer] Transfer updated: id=${transfer._id}, status=${transfer.status}`,
      );

      if (transfer.transferDirection === EnumTransferDirection.RESTAURANT) {
        const orderUpdateResult = await this.orderModel.updateMany(
          { transferGroup: transfer.transferGroup },
          {
            $set: { status: EnumOrderStatus.DISBURSED },
            $push: {
              statusTransitions: {
                status: EnumOrderStatus.DISBURSED,
                timestamp: new Date(),
              },
            },
          },
          { session },
        );

        this.logger.log(
          `[processSuccessfulTransfer] Marked ${orderUpdateResult.modifiedCount} order(s) as DISBURSED for transferGroup=${transfer.transferGroup}`,
        );
      }

      await session.commitTransaction();
      this.logger.log(
        `[processSuccessfulTransfer] Transaction committed: transferId=${transfer._id}`,
      );
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      this.logger.error(
        `[processSuccessfulTransfer] Transaction aborted for transferId=${transfer._id}: ${error?.message}`,
      );
      throw error;
    } finally {
      session.endSession();
    }

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyTransferSuccess(transfer).catch((error) => {
      this.logger.error(
        `[processSuccessfulTransfer] Failed to emit transfer success notification for transfer: id=${transfer._id}`,
        error.message,
      );
    });
  }

  private async processFailedTransfer(
    webhook: ITranzakWebhookResponse<ITranzakWebhookTransferResponse>,
  ) {
    const webhookData = webhook.resource;

    this.logger.log(
      `[processFailedTransfer] Processing: transferId=${webhookData.transferId}, ref=${webhookData.customTransactionRef}`,
    );

    const transfer = await this.transferModel.findOne({
      _id: webhookData.customTransactionRef,
      deleted: false,
    });

    if (!transfer) {
      this.logger.error(
        `[processFailedTransfer] Transfer not found: id=${webhookData.customTransactionRef}`,
      );
      throw new NotFoundException('Transfer not found');
    }

    if (
      transfer.status === EnumTransferStatuses.FAILED ||
      transfer.status === EnumTransferStatuses.COMPLETED
    ) {
      this.logger.warn(
        `[processFailedTransfer] Transfer already in final status ${transfer.status}, skipping. id=${transfer._id}`,
      );
      return;
    }

    transfer.status = EnumTransferStatuses.FAILED;
    transfer.transferWebhookDetails = this.buildTransferWebhookDetails(webhook);
    await transfer.save();

    this.logger.log(
      `[processFailedTransfer] Transfer updated: id=${transfer._id}, status=${transfer.status}, error=${webhookData.errorMessage}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyTransferFailure(transfer).catch((error) => {
      this.logger.error(
        `[processFailedTransfer] Failed to emit transfer failure notification for transfer: id=${transfer._id}`,
        error.message,
      );
    });
  }

  private async processTopupTransfer(
    webhook: ITranzakWebhookResponse<ITranzakWebhookTransferResponse>,
  ) {
    const webhookData = webhook.resource;

    this.logger.log(
      `[processTopupTransfer] Processing topup webhook: transferId=${webhookData.transferId}, status=${webhookData.status}, ref=${webhookData.customTransactionRef}`,
    );

    const transferGroup = await this.transferGroupModel.findOne({
      _id: webhookData.customTransactionRef,
      deleted: false,
    });

    if (!transferGroup) {
      this.logger.error(
        `[processTopupTransfer] Transfer group not found: transferGroupId=${webhookData.customTransactionRef}`,
      );
      throw new NotFoundException('Transfer group not found');
    }

    if (transferGroup.topupStatus === EnumTranzakTopupStatus.SUCCESSFUL) {
      this.logger.warn(
        `[processTopupTransfer] Topup already successful, skipping. transferGroupId=${transferGroup._id}`,
      );
      return;
    }

    if (webhookData.status === EnumTranzakWebhookStatus.SUCCESSFUL) {
      transferGroup.topupStatus = EnumTranzakTopupStatus.SUCCESSFUL;
    } else {
      transferGroup.topupStatus = EnumTranzakTopupStatus.FAILED;
    }

    transferGroup.topupWebhookDetails =
      this.buildTransferWebhookDetails(webhook);
    await transferGroup.save();

    this.logger.log(
      `[processTopupTransfer] Updated transferGroup=${transferGroup._id} with topupStatus=${webhookData.status}`,
    );
  }

  private async findRefund(
    webhookData: ITranzakWebhookRefundResponse,
  ): Promise<RefundDocument | null> {
    // The merchantRefundRef is the refund id we sent as merchantRefundNumber
    // when initiating the refund — it can be null, so fall back to the
    // transaction id stored on the refund.
    if (
      webhookData.merchantRefundRef &&
      Types.ObjectId.isValid(webhookData.merchantRefundRef)
    ) {
      const refund = await this.refundModel.findOne({
        _id: new Types.ObjectId(webhookData.merchantRefundRef),
      });
      if (refund) {
        return refund;
      }
    }

    return this.refundModel.findOne({
      transactionId: webhookData.refundedTransactionId,
    });
  }

  private async notifyPaymentSuccess(order: OrderDocument) {
    this.logger.log(
      `[TranzakWebhookService] Emitting order created event for order: id=${order._id}`,
    );

    const orderObject = order.toObject();

    let restaurantMemberUserIds: string[] = [];
    try {
      this.logger.log(
        `[TranzakWebhookService] Finding restaurant members for restaurant: ${order.restaurant}`,
      );
      const usersToSend = await this.restaurantMemberModel
        .find({
          restaurant: order.restaurant,
        })
        .select('user');
      this.logger.log(
        `[TranzakWebhookService] Found ${usersToSend.length} users to notify `,
      );
      restaurantMemberUserIds = usersToSend.map((item) => item.user.toString());
      this.logger.log(
        `[TranzakWebhookService] Restaurant member user IDs to notify: ${restaurantMemberUserIds.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to find restaurant members: ${error.message}`,
      );
    }

    try {
      const orderToSendToRestaurant = plainToInstance(
        OrderRestaurantOutputDto,
        orderObject,
        {
          excludeExtraneousValues: true,
        },
      );
      const notification: INotification<OrderRestaurantOutputDto> = {
        type: EnumNotificationType.ORDER_STATUS_CHANGED,
        data: orderToSendToRestaurant,
      };
      this.eventsGateway.emitToUsers({
        userIds: restaurantMemberUserIds,
        event: EnumWebSocketEventType.RESTAURANT_APPLICATION,
        data: notification,
      });
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit restaurant member notification: ${error.message}`,
      );
    }

    const orderId = order._id.toString();
    await this.sendPaymentFcm(
      order,
      restaurantMemberUserIds,
      EnumNotificationI18nType.ORDER_PAID_RESTAURANT,
      `${env.restaurantFrontendUrl}/orders/${orderId}`,
    );

    if (order.createdBy) {
      try {
        const clientId = order.createdBy.toString();
        this.logger.log(
          `[TranzakWebhookService] Notifying order creator: ${clientId}`,
        );
        const orderToSendToClient = plainToInstance(
          OrderClientOutputDto,
          orderObject,
          {
            excludeExtraneousValues: true,
          },
        );
        const notification: INotification<OrderClientOutputDto> = {
          type: EnumNotificationType.ORDER_STATUS_CHANGED,
          data: orderToSendToClient,
        };
        this.eventsGateway.emitToUser({
          userId: clientId,
          event: EnumWebSocketEventType.CLIENT_APPLICATION,
          data: notification,
        });
      } catch (error) {
        this.logger.error(
          `[TranzakWebhookService] Failed to emit client notification: ${error.message}`,
        );
      }

      await this.sendPaymentFcm(
        order,
        [order.createdBy.toString()],
        EnumNotificationI18nType.ORDER_PAID_CLIENT,
        `${env.clientFrontendUrl}/orders/${orderId}`,
      );
    }
  }

  private async notifyPaymentFailure(order: OrderDocument) {
    if (!order.createdBy) {
      return;
    }

    try {
      const clientId = order.createdBy.toString();
      this.logger.log(
        `[TranzakWebhookService] Notifying order creator of failed payment: ${clientId}`,
      );
      const orderObject = order.toObject();
      const orderToSendToClient = plainToInstance(
        OrderClientOutputDto,
        orderObject,
        {
          excludeExtraneousValues: true,
        },
      );
      const notification: INotification<OrderClientOutputDto> = {
        type: EnumNotificationType.ORDER_STATUS_CHANGED,
        data: orderToSendToClient,
      };
      this.eventsGateway.emitToUser({
        userId: clientId,
        event: EnumWebSocketEventType.CLIENT_APPLICATION,
        data: notification,
      });
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit client notification for failed payment: ${error.message}`,
      );
    }

    const orderId = order._id.toString();
    await this.sendPaymentFcm(
      order,
      [order.createdBy.toString()],
      EnumNotificationI18nType.ORDER_PAYMENT_FAILED_CLIENT,
      `${env.clientFrontendUrl}/orders/${orderId}`,
    );
  }

  private async notifyRefundSuccess(refund: RefundDocument) {
    // Websocket-only notification to admins so the refunds table stays in
    // sync in real time.
    try {
      const adminUsers = await this.userModel
        .find({
          role: EnumUserRole.ADMIN,
          deleted: false,
        })
        .select('_id');
      const adminUserIds = adminUsers.map((admin) => admin._id.toString());

      if (adminUserIds.length > 0) {
        const refundToSendToAdmin = plainToInstance(
          RefundPrivateOutputDto,
          refund.toObject(),
          { excludeExtraneousValues: true },
        );
        const adminNotification: INotification<RefundPrivateOutputDto> = {
          type: EnumNotificationType.REFUND_STATUS_CHANGED,
          data: refundToSendToAdmin,
        };
        this.eventsGateway.emitToUsers({
          userIds: adminUserIds,
          event: EnumWebSocketEventType.ADMIN_APPLICATION,
          data: adminNotification,
        });
      }
    } catch (error) {
      this.logger.error(
        `[notifyRefundSuccess] Failed to emit admin notification: ${error.message}`,
      );
    }

    if (!refund.createdBy) {
      return;
    }

    try {
      const clientId = refund.createdBy.toString();
      this.logger.log(
        `[TranzakWebhookService] Notifying order creator of successful refund: ${clientId}`,
      );
      const refundObject = refund.toObject();
      const refundToSendToClient = plainToInstance(
        RefundPublicOutputDto,
        refundObject,
        {
          excludeExtraneousValues: true,
        },
      );
      const notification: INotification<RefundPublicOutputDto> = {
        type: EnumNotificationType.REFUND_STATUS_CHANGED,
        data: refundToSendToClient,
      };
      this.eventsGateway.emitToUser({
        userId: clientId,
        event: EnumWebSocketEventType.CLIENT_APPLICATION,
        data: notification,
      });
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit client notification for successful refund: ${error.message}`,
      );
    }

    try {
      const clientId = refund.createdBy!.toString();
      const installations = await this.fcmTokenModel
        .find({ user: new Types.ObjectId(clientId) })
        .populate<{ user: User }>('user')
        .lean();

      if (installations.length === 0) {
        this.logger.log(
          `[TranzakWebhookService] No FCM installations for refund creator: refundId=${refund._id}`,
        );
      } else {
        const language = installations[0].user?.language ?? EnumUserLanguage.FR;
        const { title, body } = getNotificationMessage(
          EnumNotificationI18nType.REFUND_SUCCESSFUL_CLIENT,
          language,
        );
        const installationIds = installations.map(
          (installation) => installation.installationId,
        );
        const orderId = (refund.order as Types.ObjectId).toString();

        const fcmResults = await this.fcmService.sendToDevices(
          installationIds,
          {
            title,
            body,
            data: {
              orderId,
              refundId: refund._id.toString(),
              status: refund.status,
              click_action: `${env.clientFrontendUrl}/orders/${orderId}`,
            },
          },
        );
        this.logger.log(
          `[TranzakWebhookService] Refund success client FCM results: ${JSON.stringify(fcmResults)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to send FCM notification to client for successful refund: ${error.message}`,
      );
    }
  }

  private async notifyRefundFailure(refund: RefundDocument) {
    const clientUserIds = refund.createdBy ? [refund.createdBy.toString()] : [];

    let adminUserIds: string[] = [];
    try {
      const adminUsers = await this.userModel
        .find({
          role: EnumUserRole.ADMIN,
          deleted: false,
        })
        .select('_id');
      adminUserIds = adminUsers.map((admin) => admin._id.toString());

      this.logger.log(
        `[notifyRefundFailure] Found ${adminUserIds.length} admin(s) to notify for refund: id=${refund._id}`,
      );
    } catch (error) {
      this.logger.error(
        `[notifyRefundFailure] Failed to find admin users: ${error.message}`,
      );
    }

    if (clientUserIds.length === 0 && adminUserIds.length === 0) {
      return;
    }

    try {
      if (clientUserIds.length > 0) {
        const refundToSendToClient = plainToInstance(
          RefundPublicOutputDto,
          refund.toObject(),
          { excludeExtraneousValues: true },
        );
        const notification: INotification<RefundPublicOutputDto> = {
          type: EnumNotificationType.REFUND_STATUS_CHANGED,
          data: refundToSendToClient,
        };
        this.eventsGateway.emitToUsers({
          userIds: clientUserIds,
          event: EnumWebSocketEventType.CLIENT_APPLICATION,
          data: notification,
        });
      }
      if (adminUserIds.length > 0) {
        const refundToSendToAdmin = plainToInstance(
          RefundPrivateOutputDto,
          refund.toObject(),
          { excludeExtraneousValues: true },
        );
        const adminNotification: INotification<RefundPrivateOutputDto> = {
          type: EnumNotificationType.REFUND_STATUS_CHANGED,
          data: refundToSendToAdmin,
        };
        this.eventsGateway.emitToUsers({
          userIds: adminUserIds,
          event: EnumWebSocketEventType.ADMIN_APPLICATION,
          data: adminNotification,
        });
      }
    } catch (error) {
      this.logger.error(
        `[notifyRefundFailure] Failed to emit refund failure notification: ${error.message}`,
      );
    }

    const orderId = (refund.order as Types.ObjectId).toString();
    await this.sendRefundFcm(
      refund,
      clientUserIds,
      EnumNotificationI18nType.REFUND_FAILED_CLIENT,
      `${env.clientFrontendUrl}/orders/${orderId}`,
    );
    await this.sendRefundFcm(
      refund,
      adminUserIds,
      EnumNotificationI18nType.REFUND_FAILED_ADMIN,
      `${env.adminFrontendUrl}/refunds`,
    );
  }

  private async incrementMenuOrdersCount(order: OrderDocument) {
    this.logger.log(
      `[TranzakWebhookService] Incrementing ordersCount for ${order.items.length} menu(s) from order: id=${order._id}`,
    );

    for (const item of order.items) {
      const menu = await this.menuModel.findByIdAndUpdate(item.product, {
        $inc: { ordersCount: item.quantity },
      });

      if (menu) {
        this.logger.log(
          `[TranzakWebhookService] Menu ordersCount updated: id=${menu._id}, ordersCount=${menu.ordersCount}, quantity=${item.quantity}`,
        );
      } else {
        this.logger.warn(
          `[TranzakWebhookService] Menu not found for ordersCount update: productId=${item.product}, orderId=${order._id}`,
        );
      }
    }

    this.logger.log(
      `[TranzakWebhookService] Background menu ordersCount update completed for order: id=${order._id}`,
    );
  }

  private async notifyTransferSuccess(transfer: TransferDocument) {
    let restaurantMemberUserIds: string[] = [];
    if (transfer.transferDirection === EnumTransferDirection.RESTAURANT) {
      try {
        const usersToSend = await this.restaurantMemberModel
          .find({
            restaurant: transfer.restaurant,
            role: EnumRestaurantMemberRole.OWNER,
          })
          .select('user');
        restaurantMemberUserIds = usersToSend.map((item) =>
          item.user.toString(),
        );

        this.logger.log(
          `[notifyTransferSuccess] Found ${restaurantMemberUserIds.length} restaurant member(s) to notify for transfer: id=${transfer._id}`,
        );
      } catch (error) {
        this.logger.error(
          `[notifyTransferSuccess] Failed to find restaurant members: ${error.message}`,
        );
      }
    }

    let adminUserIds: string[] = [];
    try {
      const adminUsers = await this.userModel
        .find({
          role: EnumUserRole.ADMIN,
          deleted: false,
        })
        .select('_id');
      adminUserIds = adminUsers.map((admin) => admin._id.toString());

      this.logger.log(
        `[notifyTransferSuccess] Found ${adminUserIds.length} admin(s) to notify for transfer: id=${transfer._id}`,
      );
    } catch (error) {
      this.logger.error(
        `[notifyTransferSuccess] Failed to find admin users: ${error.message}`,
      );
    }

    if (restaurantMemberUserIds.length === 0 && adminUserIds.length === 0) {
      return;
    }

    try {
      if (restaurantMemberUserIds.length > 0) {
        const transferToSend = plainToInstance(
          TransferPublicOutputDto,
          transfer.toObject(),
          { excludeExtraneousValues: true },
        );
        const notification: INotification<TransferPublicOutputDto> = {
          type: EnumNotificationType.TRANSFER_STATUS_CHANGED,
          data: transferToSend,
        };
        this.eventsGateway.emitToUsers({
          userIds: restaurantMemberUserIds,
          event: EnumWebSocketEventType.RESTAURANT_APPLICATION,
          data: notification,
        });
      }
      if (adminUserIds.length > 0) {
        const populatedTransfer = await transfer.populate([
          'restaurant',
          'transferGroup',
        ]);
        const adminTransferToSend = plainToInstance(
          TransferPrivateOutputDto,
          populatedTransfer.toObject(),
          { excludeExtraneousValues: true },
        );
        const adminNotification: INotification<TransferPrivateOutputDto> = {
          type: EnumNotificationType.TRANSFER_STATUS_CHANGED,
          data: adminTransferToSend,
        };
        this.eventsGateway.emitToUsers({
          userIds: adminUserIds,
          event: EnumWebSocketEventType.ADMIN_APPLICATION,
          data: adminNotification,
        });
      }
    } catch (error) {
      this.logger.error(
        `[notifyTransferSuccess] Failed to emit transfer notification: ${error.message}`,
      );
    }

    await this.sendTransferFcm(
      transfer,
      restaurantMemberUserIds,
      EnumNotificationI18nType.TRANSFER_COMPLETED_RESTAURANT,
      `${env.restaurantFrontendUrl}/payments`,
    );
    await this.sendTransferFcm(
      transfer,
      adminUserIds,
      EnumNotificationI18nType.TRANSFER_COMPLETED_ADMIN,
      `${env.adminFrontendUrl}/transfers`,
    );
  }

  private async notifyTransferFailure(transfer: TransferDocument) {
    let restaurantMemberUserIds: string[] = [];
    if (transfer.transferDirection === EnumTransferDirection.RESTAURANT) {
      try {
        const usersToSend = await this.restaurantMemberModel
          .find({
            restaurant: transfer.restaurant,
            role: EnumRestaurantMemberRole.OWNER,
          })
          .select('user');
        restaurantMemberUserIds = usersToSend.map((item) =>
          item.user.toString(),
        );

        this.logger.log(
          `[notifyTransferFailure] Found ${restaurantMemberUserIds.length} restaurant member(s) to notify for transfer: id=${transfer._id}`,
        );
      } catch (error) {
        this.logger.error(
          `[notifyTransferFailure] Failed to find restaurant members: ${error.message}`,
        );
      }
    }

    let adminUserIds: string[] = [];
    try {
      const adminUsers = await this.userModel
        .find({
          role: EnumUserRole.ADMIN,
          deleted: false,
        })
        .select('_id');
      adminUserIds = adminUsers.map((admin) => admin._id.toString());

      this.logger.log(
        `[notifyTransferFailure] Found ${adminUserIds.length} admin(s) to notify for transfer: id=${transfer._id}`,
      );
    } catch (error) {
      this.logger.error(
        `[notifyTransferFailure] Failed to find admin users: ${error.message}`,
      );
    }

    if (restaurantMemberUserIds.length === 0 && adminUserIds.length === 0) {
      return;
    }

    try {
      if (restaurantMemberUserIds.length > 0) {
        const transferToSend = plainToInstance(
          TransferPublicOutputDto,
          transfer.toObject(),
          { excludeExtraneousValues: true },
        );
        const notification: INotification<TransferPublicOutputDto> = {
          type: EnumNotificationType.TRANSFER_STATUS_CHANGED,
          data: transferToSend,
        };
        this.eventsGateway.emitToUsers({
          userIds: restaurantMemberUserIds,
          event: EnumWebSocketEventType.RESTAURANT_APPLICATION,
          data: notification,
        });
      }
      if (adminUserIds.length > 0) {
        const populatedTransfer = await transfer.populate([
          'restaurant',
          'transferGroup',
        ]);
        const adminTransferToSend = plainToInstance(
          TransferPrivateOutputDto,
          populatedTransfer.toObject(),
          { excludeExtraneousValues: true },
        );
        const adminNotification: INotification<TransferPrivateOutputDto> = {
          type: EnumNotificationType.TRANSFER_STATUS_CHANGED,
          data: adminTransferToSend,
        };
        this.eventsGateway.emitToUsers({
          userIds: adminUserIds,
          event: EnumWebSocketEventType.ADMIN_APPLICATION,
          data: adminNotification,
        });
      }
    } catch (error) {
      this.logger.error(
        `[notifyTransferFailure] Failed to emit transfer notification: ${error.message}`,
      );
    }

    await this.sendTransferFcm(
      transfer,
      restaurantMemberUserIds,
      EnumNotificationI18nType.TRANSFER_FAILED_RESTAURANT,
      `${env.restaurantFrontendUrl}/payments`,
    );
    await this.sendTransferFcm(
      transfer,
      adminUserIds,
      EnumNotificationI18nType.TRANSFER_FAILED_ADMIN,
      `${env.adminFrontendUrl}/transfers`,
    );
  }

  private async sendTransferFcm(
    transfer: TransferDocument,
    userIds: string[],
    i18nType: EnumNotificationI18nType,
    clickAction: string,
  ) {
    if (userIds.length === 0) {
      return;
    }

    try {
      const installations = await this.fcmTokenModel
        .find({
          user: {
            $in: userIds.map((id) => new Types.ObjectId(id)),
          },
        })
        .populate<{ user: User }>('user')
        .lean();

      if (installations.length === 0) {
        this.logger.log(
          `[sendTransferFcm] No FCM installations for users of transfer: id=${transfer._id}`,
        );
        return;
      }

      const languageGroups = new Map<EnumUserLanguage, string[]>();
      for (const installation of installations) {
        const language = installation.user?.language ?? EnumUserLanguage.FR;
        const ids = languageGroups.get(language) ?? [];
        ids.push(installation.installationId);
        languageGroups.set(language, ids);
      }

      const transferId = transfer._id.toString();

      for (const [language, installationIds] of languageGroups) {
        const { title, body } = getNotificationMessage(i18nType, language);
        const fcmResults = await this.fcmService.sendToDevices(
          installationIds,
          {
            title,
            body,
            data: {
              click_action: clickAction,
              transferId,
            },
          },
        );
        this.logger.log(
          `[sendTransferFcm] FCM transfer notification sent (${language}): ${JSON.stringify(fcmResults)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[sendTransferFcm] Failed to send FCM notification for transfer: id=${transfer._id}`,
        error.message,
      );
    }
  }

  private async sendRefundFcm(
    refund: RefundDocument,
    userIds: string[],
    i18nType: EnumNotificationI18nType,
    clickAction: string,
  ) {
    if (userIds.length === 0) {
      return;
    }

    try {
      const installations = await this.fcmTokenModel
        .find({
          user: {
            $in: userIds.map((id) => new Types.ObjectId(id)),
          },
        })
        .populate<{ user: User }>('user')
        .lean();

      if (installations.length === 0) {
        this.logger.log(
          `[sendRefundFcm] No FCM installations for users of refund: id=${refund._id}`,
        );
        return;
      }

      const languageGroups = new Map<EnumUserLanguage, string[]>();
      for (const installation of installations) {
        const language = installation.user?.language ?? EnumUserLanguage.FR;
        const ids = languageGroups.get(language) ?? [];
        ids.push(installation.installationId);
        languageGroups.set(language, ids);
      }

      const refundId = refund._id.toString();
      const orderId = (refund.order as Types.ObjectId).toString();

      for (const [language, installationIds] of languageGroups) {
        const { title, body } = getNotificationMessage(i18nType, language);
        const fcmResults = await this.fcmService.sendToDevices(
          installationIds,
          {
            title,
            body,
            data: {
              click_action: clickAction,
              refundId,
              orderId,
            },
          },
        );
        this.logger.log(
          `[sendRefundFcm] FCM refund notification sent (${language}): ${JSON.stringify(fcmResults)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[sendRefundFcm] Failed to send FCM notification for refund: id=${refund._id}`,
        error.message,
      );
    }
  }

  private async sendPaymentFcm(
    order: OrderDocument,
    userIds: string[],
    i18nType: EnumNotificationI18nType,
    clickAction: string,
  ) {
    if (userIds.length === 0) {
      return;
    }

    try {
      const installations = await this.fcmTokenModel
        .find({
          user: {
            $in: userIds.map((id) => new Types.ObjectId(id)),
          },
        })
        .populate<{ user: User }>('user')
        .lean();

      if (installations.length === 0) {
        this.logger.log(
          `[sendPaymentFcm] No FCM installations for users of order: id=${order._id}`,
        );
        return;
      }

      const languageGroups = new Map<EnumUserLanguage, string[]>();
      for (const installation of installations) {
        const language = installation.user?.language ?? EnumUserLanguage.FR;
        const ids = languageGroups.get(language) ?? [];
        ids.push(installation.installationId);
        languageGroups.set(language, ids);
      }

      const orderId = order._id.toString();

      for (const [language, installationIds] of languageGroups) {
        const { title, body } = getNotificationMessage(i18nType, language);
        const fcmResults = await this.fcmService.sendToDevices(
          installationIds,
          {
            title,
            body,
            data: {
              click_action: clickAction,
              orderId,
              status: order.status,
            },
          },
        );
        this.logger.log(
          `[sendPaymentFcm] FCM payment notification sent (${language}): ${JSON.stringify(fcmResults)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[sendPaymentFcm] Failed to send FCM notification for order: id=${order._id}`,
        error.message,
      );
    }
  }

  private buildPaymentWebhookDetails(
    webhook: ITranzakWebhookResponse<ITranzakWebhookPaymentResponse>,
  ): PaymentWebhookDetails {
    const webhookData = webhook.resource;
    const webhookId = webhook.webhookId;

    return {
      webhookId,
      requestId: webhookData.requestId,
      transactionId: webhookData.transactionId,
      partnerTransactionId: webhookData.partnerTransactionId,
      mchTransactionRef: webhookData.mchTransactionRef,
      transactionTime: webhookData.transactionTime
        ? new Date(webhookData.transactionTime)
        : undefined,
      amount: webhookData.amount,
      currencyCode: webhookData.currencyCode,
      status: webhookData.status,
      transactionStatus: webhookData.transactionStatus,
      mobileWalletNumber: webhookData.mobileWalletNumber ?? undefined,
      paymentMethod: webhookData.payer?.paymentMethod,
      payerName: webhookData.payer?.name,
      payerFee: webhookData.payer?.fee,
      netAmountPaid: webhookData.payer?.netAmountPaid,
      merchantFee: webhookData.merchant?.fee,
      netAmountReceived: webhookData.merchant?.netAmountReceived,
      errorCode: webhookData.errorCode,
      errorMessage: webhookData.errorMessage,
    };
  }

  private buildRefundWebhookDetails(
    webhook: ITranzakWebhookResponse<ITranzakWebhookRefundResponse>,
  ): RefundWebhookDetails {
    const webhookData = webhook.resource;
    const webhookId = webhook.webhookId;

    return {
      webhookId,
      refundId: webhookData.refundId,
      refundedTransactionId: webhookData.refundedTransactionId,
      amount: webhookData.amount,
      currencyCode: webhookData.currencyCode,
      status: webhookData.status,
      merchantRefundRef: webhookData.merchantRefundRef ?? undefined,
      note: webhookData.note,
      reasonCode: webhookData.reasonCode,
      reason: webhookData.reason,
      createdAt: webhookData.createdAt,
      approvedAt: webhookData.approvedAt,
    };
  }

  private buildTransferWebhookDetails(
    webhook: ITranzakWebhookResponse<ITranzakWebhookTransferResponse>,
  ): TransferWebhookDetails {
    const webhookData = webhook.resource;

    return {
      transferId: webhookData.transferId,
      status: webhookData.status,
      payeeAccountId: webhookData.payeeAccountId,
      fundingAccountId: webhookData.fundingAccountId,
      payeeAccountName: webhookData.payeeAccountName,
      destinationServiceName: webhookData.destinationServiceName,
      payeeNote: webhookData.payeeNote,
      description: webhookData.description,
      amount: webhookData.amount,
      currencyCode: webhookData.currencyCode,
      fee: webhookData.fee,
      customTransactionRef: webhookData.customTransactionRef,
      createdByAppId: webhookData.createdByAppId,
      type: webhookData.type,
      transactionId: webhookData.transactionId,
      transactionTime: webhookData.transactionTime,
      partnerTransactionId: webhookData.partnerTransactionId,
      sendSmsToPayee: webhookData.sendSmsToPayee,
      smsContent: webhookData.smsContent,
      smsMobileNumber: webhookData.smsMobileNumber,
      payeeSmsSuccess: webhookData.payeeSmsSuccess,
      createdAt: webhookData.createdAt,
      errorMessage: webhookData.errorMessage,
      refundId: webhookData.refundId,
    };
  }
}
