import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Model, Types } from 'mongoose';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';
import { InjectModel } from '@nestjs/mongoose';
import {
  Order,
  OrderDocument,
  PaymentWebhookDetails,
  RefundWebhookDetails,
} from 'src/orders/entities/order.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { WebSocketService } from 'src/web-socket/web-socket-service';
import { EnumWebSocketEventType } from 'src/common/enums/web-socket-events';
import {
  OrderClientOutputDto,
  OrderRestaurantOutputDto,
} from 'src/orders/dto/output/order-output.dto';
import { plainToInstance } from 'class-transformer';
import { RestaurantMember } from 'src/restaurant-members/entities/restaurant-member.entity';
import { EnumNotificationType } from 'src/common/enums/notification-type';
import { INotification } from 'src/common/interfaces/notification';
import { FcmService } from 'src/fcm/fcm.service';
import {
  FcmToken,
  FcmTokenDocument,
} from 'src/fcm-tokens/entities/fcm-token.entity';
import { User } from 'src/users/entities/user.entity';
import { EnumUserLanguage } from 'src/common/enums/user-language';
import { EnumNotificationI18nType } from 'src/common/enums/notification-internationalization-type';
import { getNotificationMessage } from 'src/common/utils/get-fcm-notification-message';
import { env } from 'src/config/env';
import { ITranzakWebhookResponse } from 'src/common/interfaces/tranzak/response';
import { EnumTranzakWebhookEventType } from 'src/common/enums/tranzak/event-type';
import { ITranzakWebhookPaymentResponse } from 'src/common/interfaces/tranzak/payment';
import { ITranzakWebhookRefundResponse } from 'src/common/interfaces/tranzak/refund';
import { EnumTranzakPaymentStatus } from 'src/common/enums/tranzak/payment-status';
import { EnumRefundStatus } from 'src/common/enums/refund-statuses';
import { EnumTranzakWebhookRefundStatus } from 'src/common/enums/tranzak/refund-webhook-status';
import { EnumTranzakWebhookStatus } from 'src/common/enums/tranzak/webhook-status';

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
      // const typedWebhook: ITranzakWebhook<TransferWebhookData> =
      //   webhook as ITranzakWebhook<TransferWebhookData>;
      // this.logger.log(
      //   '[TranzakWebhookService] Processing transfer completed webhook',
      //   typedWebhook.data,
      // );
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
    return 'This action adds a new flwWebhook';
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

    const order = await this.findRefundOrder(webhookData);

    if (!order) {
      this.logger.error(
        `[TranzakWebhookService] Order not found for refund: refundId=${webhookData.refundId}, merchantRefundRef=${webhookData.merchantRefundRef}, refundedTransactionId=${webhookData.refundedTransactionId}`,
      );
      throw new NotFoundException('Order not found');
    }

    this.logger.log(
      `[TranzakWebhookService] Order found: id=${order._id}, refundStatus=${order.refundStatus}`,
    );

    if (order.refundStatus === EnumRefundStatus.SUCCESSFUL) {
      this.logger.warn(
        `[TranzakWebhookService] Refund already processed, skipping. id=${order._id}, refundStatus=${order.refundStatus}`,
      );
      return;
    }

    this.logger.log(
      `[TranzakWebhookService] Updating order refund status to SUCCESSFUL: id=${order._id}`,
    );

    order.refundStatus = EnumRefundStatus.SUCCESSFUL;
    order.refundWebhookDetails = this.buildRefundWebhookDetails(webhook);

    this.logger.log(
      `[TranzakWebhookService] Saving order after successful refund: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[TranzakWebhookService] Order saved successfully: id=${order._id}, refundStatus=${order.refundStatus}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyRefundSuccess(order).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit refund success notification for order: id=${order._id}`,
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

    const order = await this.findRefundOrder(webhookData);

    if (!order) {
      this.logger.error(
        `[TranzakWebhookService] Order not found for refund: refundId=${webhookData.refundId}, merchantRefundRef=${webhookData.merchantRefundRef}, refundedTransactionId=${webhookData.refundedTransactionId}`,
      );
      throw new NotFoundException('Order not found');
    }

    this.logger.log(
      `[TranzakWebhookService] Order found: id=${order._id}, refundStatus=${order.refundStatus}`,
    );

    if (
      order.refundStatus === EnumRefundStatus.FAILED ||
      order.refundStatus === EnumRefundStatus.SUCCESSFUL
    ) {
      this.logger.warn(
        `[TranzakWebhookService] Refund already processed, skipping. id=${order._id}, refundStatus=${order.refundStatus}`,
      );
      return;
    }

    this.logger.log(
      `[TranzakWebhookService] Updating order refund status to FAILED: id=${order._id}`,
    );

    order.refundStatus = EnumRefundStatus.FAILED;
    order.refundWebhookDetails = this.buildRefundWebhookDetails(webhook);

    this.logger.log(
      `[TranzakWebhookService] Saving order after failed refund: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[TranzakWebhookService] Order saved successfully: id=${order._id}, refundStatus=${order.refundStatus}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyRefundFailure(order).catch((error) => {
      this.logger.error(
        `[TranzakWebhookService] Failed to emit refund failure notification for order: id=${order._id}`,
        error.message,
      );
    });
  }

  private async findRefundOrder(
    webhookData: ITranzakWebhookRefundResponse,
  ): Promise<OrderDocument | null> {
    // The merchantRefundRef is the order id we sent as merchantRefundNumber
    // when initiating the refund — it can be null, so fall back to the
    // refunded transaction id.
    if (
      webhookData.merchantRefundRef &&
      Types.ObjectId.isValid(webhookData.merchantRefundRef)
    ) {
      return this.orderModel.findOne({
        _id: new Types.ObjectId(webhookData.merchantRefundRef),
      });
    }

    return this.orderModel.findOne({
      'paymentWebhookDetails.transactionId': webhookData.refundedTransactionId,
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

    try {
      if (restaurantMemberUserIds.length === 0) {
        this.logger.log(
          `[TranzakWebhookService] No restaurant members to send FCM for order: id=${order._id}`,
        );
      } else {
        const installations = await this.fcmTokenModel
          .find({
            user: {
              $in: restaurantMemberUserIds.map((id) => new Types.ObjectId(id)),
            },
          })
          .populate<{ user: User }>('user')
          .lean();

        if (installations.length === 0) {
          this.logger.log(
            `[TranzakWebhookService] No FCM installations for restaurant members of order: id=${order._id}`,
          );
        } else {
          const languageGroups = new Map<EnumUserLanguage, string[]>();

          for (const installation of installations) {
            const language = installation.user?.language ?? EnumUserLanguage.FR;
            const ids = languageGroups.get(language) ?? [];
            ids.push(installation.installationId);
            languageGroups.set(language, ids);
          }

          const orderId = order._id.toString();

          for (const [language, installationIds] of languageGroups) {
            const { title, body } = getNotificationMessage(
              EnumNotificationI18nType.ORDER_PAID_RESTAURANT,
              language,
            );
            const fcmResults = await this.fcmService.sendToDevices(
              installationIds,
              {
                title,
                body,
                data: {
                  orderId,
                  status: order.status,
                  click_action: `${env.restaurantFrontendUrl}/orders/${orderId}`,
                },
              },
            );
            this.logger.log(
              `[TranzakWebhookService] Restaurant FCM results for language ${language}: ${JSON.stringify(fcmResults)}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to send FCM notification to restaurant members: ${error.message}`,
      );
    }

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

      try {
        const clientId = order.createdBy.toString();
        const installations = await this.fcmTokenModel
          .find({ user: new Types.ObjectId(clientId) })
          .populate<{ user: User }>('user')
          .lean();

        if (installations.length === 0) {
          this.logger.log(
            `[TranzakWebhookService] No FCM installations for order creator: id=${order._id}`,
          );
        } else {
          const language =
            installations[0].user?.language ?? EnumUserLanguage.FR;
          const { title, body } = getNotificationMessage(
            EnumNotificationI18nType.ORDER_PAID_CLIENT,
            language,
          );
          const installationIds = installations.map(
            (installation) => installation.installationId,
          );
          const orderId = order._id.toString();

          const fcmResults = await this.fcmService.sendToDevices(
            installationIds,
            {
              title,
              body,
              data: {
                orderId,
                status: order.status,
                click_action: `${env.clientFrontendUrl}/orders/${orderId}`,
              },
            },
          );
          this.logger.log(
            `[TranzakWebhookService] Client FCM results: ${JSON.stringify(fcmResults)}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[TranzakWebhookService] Failed to send FCM notification to client: ${error.message}`,
        );
      }
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

    try {
      const clientId = order.createdBy.toString();
      const installations = await this.fcmTokenModel
        .find({ user: new Types.ObjectId(clientId) })
        .populate<{ user: User }>('user')
        .lean();

      if (installations.length === 0) {
        this.logger.log(
          `[TranzakWebhookService] No FCM installations for order creator: id=${order._id}`,
        );
      } else {
        const language = installations[0].user?.language ?? EnumUserLanguage.FR;
        const { title, body } = getNotificationMessage(
          EnumNotificationI18nType.ORDER_PAYMENT_FAILED_CLIENT,
          language,
        );
        const installationIds = installations.map(
          (installation) => installation.installationId,
        );
        const orderId = order._id.toString();

        const fcmResults = await this.fcmService.sendToDevices(
          installationIds,
          {
            title,
            body,
            data: {
              orderId,
              status: order.status,
              click_action: `${env.clientFrontendUrl}/orders/${orderId}`,
            },
          },
        );
        this.logger.log(
          `[TranzakWebhookService] Payment failure client FCM results: ${JSON.stringify(fcmResults)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[TranzakWebhookService] Failed to send FCM notification to client for failed payment: ${error.message}`,
      );
    }
  }

  private async notifyRefundSuccess(order: OrderDocument) {
    if (!order.createdBy) {
      return;
    }

    try {
      const clientId = order.createdBy.toString();
      this.logger.log(
        `[TranzakWebhookService] Notifying order creator of successful refund: ${clientId}`,
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
        type: EnumNotificationType.ORDER_REFUND_STATUS_CHANGED,
        data: orderToSendToClient,
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
      const clientId = order.createdBy.toString();
      const installations = await this.fcmTokenModel
        .find({ user: new Types.ObjectId(clientId) })
        .populate<{ user: User }>('user')
        .lean();

      if (installations.length === 0) {
        this.logger.log(
          `[TranzakWebhookService] No FCM installations for order creator: id=${order._id}`,
        );
      } else {
        const language = installations[0].user?.language ?? EnumUserLanguage.FR;
        const { title, body } = getNotificationMessage(
          EnumNotificationI18nType.ORDER_REFUNDED_CLIENT,
          language,
        );
        const installationIds = installations.map(
          (installation) => installation.installationId,
        );
        const orderId = order._id.toString();

        const fcmResults = await this.fcmService.sendToDevices(
          installationIds,
          {
            title,
            body,
            data: {
              orderId,
              status: order.status,
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

  private async notifyRefundFailure(order: OrderDocument) {
    // TODO: Maybe notify the admin and the client so further actions can be taken.
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
}
