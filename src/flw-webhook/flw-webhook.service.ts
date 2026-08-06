import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FlutterwaveWebhook,
  PaymentWebhookData,
  RefundWebhookData,
  TransferWebhookData,
} from 'src/common/interfaces/flutterwave/webhook';
import { EnumFlwWebhookEventType } from 'src/common/enums/flutterwave/flw-webhook-event-types';
import { EnumFlwPaymentWebhookStatus } from 'src/common/enums/flutterwave/flw-payment-webhook-statuses';
import { Model, Types } from 'mongoose';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';
import { InjectModel } from '@nestjs/mongoose';
import {
  Order,
  OrderDocument,
  PaymentWebhookDetails,
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

@Injectable()
export class FlwWebhookService {
  private readonly logger = new Logger(FlwWebhookService.name);

  constructor(
    private readonly eventsGateway: WebSocketService,
    @InjectModel(Menu.name) private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMember>,
  ) {}

  async processWebhook(webhook: FlutterwaveWebhook<unknown>) {
    this.logger.log(
      `[FlwWebhookService] Received webhook event: ${webhook.event}`,
    );

    if (webhook.event === EnumFlwWebhookEventType.CHARGE_COMPLETED) {
      const typedWebhook: FlutterwaveWebhook<PaymentWebhookData> =
        webhook as FlutterwaveWebhook<PaymentWebhookData>;

      this.logger.log(
        '[FlwWebhookService] Processing payment completed webhook',
        typedWebhook.data,
      );
      if (typedWebhook.data.status === EnumFlwPaymentWebhookStatus.SUCCESSFUL) {
        await this.processSuccessfulPayment(typedWebhook.data);
      } else if (
        typedWebhook.data.status === EnumFlwPaymentWebhookStatus.FAILED
      ) {
        await this.processFailedPayment(typedWebhook.data);
      } else {
        this.logger.warn(
          `[FlwWebhookService] Unhandled charge status: ${typedWebhook.data.status}, tx_ref: ${typedWebhook.data.tx_ref}`,
        );
      }
    } else if (webhook.event === EnumFlwWebhookEventType.TRANSFER_COMPLETED) {
      const typedWebhook: FlutterwaveWebhook<TransferWebhookData> =
        webhook as FlutterwaveWebhook<TransferWebhookData>;
      this.logger.log(
        '[FlwWebhookService] Processing transfer completed webhook',
        typedWebhook.data,
      );
    } else if (webhook.event === EnumFlwWebhookEventType.REFUND_COMPLETED) {
      const typedWebhook: FlutterwaveWebhook<RefundWebhookData> =
        webhook as FlutterwaveWebhook<RefundWebhookData>;
      this.logger.log(
        '[FlwWebhookService] Processing refund completed webhook',
        typedWebhook.data,
      );
    } else {
      this.logger.warn(
        `[FlwWebhookService] Ignoring unsupported webhook event: ${webhook.event}`,
      );
    }

    this.logger.log('[FlwWebhookService] Webhook processing completed');
    return 'This action adds a new flwWebhook';
  }

  private async processSuccessfulPayment(webhookData: PaymentWebhookData) {
    this.logger.log(
      `[FlwWebhookService] Processing successful payment for tx_ref: ${webhookData.tx_ref}, amount: ${webhookData.amount} ${webhookData.currency}`,
    );

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(webhookData.tx_ref),
    });

    if (!order) {
      this.logger.error(
        `[FlwWebhookService] Order not found for tx_ref: ${webhookData.tx_ref}`,
      );
      throw new NotFoundException('Order not found');
    }

    this.logger.log(
      `[FlwWebhookService] Order found: id=${order._id}, currentStatus=${order.status}`,
    );

    if (order.status !== EnumOrderStatus.PAYMENT_INITIATED) {
      this.logger.warn(
        `[FlwWebhookService] Order already processed, skipping. id=${order._id}, status=${order.status}, tx_ref: ${webhookData.tx_ref}`,
      );
      return;
    }

    this.logger.log(
      `[FlwWebhookService] Updating order status to PAID: id=${order._id}`,
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
    order.paymentWebhookDetails = this.buildPaymentWebhookDetails(webhookData);

    this.logger.log(
      `[FlwWebhookService] Saving order after successful payment: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[FlwWebhookService] Order saved successfully: id=${order._id}, status=${order.status}`,
    );

    this.logger.log(
      `[FlwWebhookService] Triggering background menu ordersCount update for order: id=${order._id}`,
    );

    // Fire-and-forget: these are non-critical side effects and should not
    // delay the webhook response.
    this.incrementMenuOrdersCount(order).catch((error) => {
      this.logger.error(
        `[FlwWebhookService] Failed to increment menu ordersCount for order: id=${order._id}`,
        error.message,
      );
    });

    this.notifyPaymentSuccess(order).catch((error) => {
      this.logger.error(
        `[FlwWebhookService] Failed to emit payment success notifications for order: id=${order._id}`,
        error.message,
      );
    });
  }

  private async notifyPaymentSuccess(order: OrderDocument) {
    this.logger.log(
      `[FlwWebhookService] Emitting order created event for order: id=${order._id}`,
    );

    const orderObject = order.toObject();

    try {
      this.logger.log(
        `[FlwWebhookService] Finding restaurant members for restaurant: ${order.restaurant}`,
      );
      const usersToSend = await this.restaurantMemberModel
        .find({
          restaurant: order.restaurant,
        })
        .select('user');
      this.logger.log(
        `[FlwWebhookService] Found ${usersToSend.length} users to notify `,
      );
      const restaurantMemberUserIds = usersToSend.map((item) =>
        item.user.toString(),
      );
      this.logger.log(
        `[FlwWebhookService] Restaurant member user IDs to notify: ${restaurantMemberUserIds.join(', ')}`,
      );

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
        `[FlwWebhookService] Failed to emit restaurant member notification: ${error.message}`,
      );
    }

    if (order.createdBy) {
      try {
        const clientId = order.createdBy.toString();
        this.logger.log(
          `[FlwWebhookService] Notifying order creator: ${clientId}`,
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
          `[FlwWebhookService] Failed to emit client notification: ${error.message}`,
        );
      }
    }
  }

  private async processFailedPayment(webhookData: PaymentWebhookData) {
    this.logger.log(
      `[FlwWebhookService] Processing failed payment for tx_ref: ${webhookData.tx_ref}, amount: ${webhookData.amount} ${webhookData.currency}`,
    );

    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(webhookData.tx_ref),
    });

    if (!order) {
      this.logger.error(
        `[FlwWebhookService] Order not found for tx_ref: ${webhookData.tx_ref}`,
      );
      throw new NotFoundException('Order not found');
    }

    this.logger.log(
      `[FlwWebhookService] Order found: id=${order._id}, currentStatus=${order.status}`,
    );

    if (order.status !== EnumOrderStatus.PAYMENT_INITIATED) {
      this.logger.warn(
        `[FlwWebhookService] Order already processed, skipping. id=${order._id}, status=${order.status}, tx_ref: ${webhookData.tx_ref}`,
      );
      return;
    }

    this.logger.log(
      `[FlwWebhookService] Updating order status to PAYMENT_FAILED: id=${order._id}`,
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
    order.paymentWebhookDetails = this.buildPaymentWebhookDetails(webhookData);

    this.logger.log(
      `[FlwWebhookService] Saving order after failed payment: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[FlwWebhookService] Order saved successfully: id=${order._id}, status=${order.status}`,
    );

    // Fire-and-forget: notification is non-critical and should not delay
    // the webhook response.
    this.notifyPaymentFailure(order).catch((error) => {
      this.logger.error(
        `[FlwWebhookService] Failed to emit payment failure notification for order: id=${order._id}`,
        error.message,
      );
    });
  }

  private async notifyPaymentFailure(order: OrderDocument) {
    if (!order.createdBy) {
      return;
    }

    try {
      const clientId = order.createdBy.toString();
      this.logger.log(
        `[FlwWebhookService] Notifying order creator of failed payment: ${clientId}`,
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
        `[FlwWebhookService] Failed to emit client notification for failed payment: ${error.message}`,
      );
    }
  }

  private async incrementMenuOrdersCount(order: OrderDocument) {
    this.logger.log(
      `[FlwWebhookService] Incrementing ordersCount for ${order.items.length} menu(s) from order: id=${order._id}`,
    );

    for (const item of order.items) {
      const menu = await this.menuModel.findByIdAndUpdate(item.product, {
        $inc: { ordersCount: item.quantity },
      });

      if (menu) {
        this.logger.log(
          `[FlwWebhookService] Menu ordersCount updated: id=${menu._id}, ordersCount=${menu.ordersCount}, quantity=${item.quantity}`,
        );
      } else {
        this.logger.warn(
          `[FlwWebhookService] Menu not found for ordersCount update: productId=${item.product}, orderId=${order._id}`,
        );
      }
    }

    this.logger.log(
      `[FlwWebhookService] Background menu ordersCount update completed for order: id=${order._id}`,
    );
  }

  private buildPaymentWebhookDetails(
    webhookData: PaymentWebhookData,
  ): PaymentWebhookDetails {
    return {
      amount: webhookData.amount,
      appFee: webhookData.app_fee,
      chargedAmount: webhookData.charged_amount,
      currency: webhookData.currency,
      ip: webhookData.ip,
      merchantFee: webhookData.merchant_fee,
      paymentType: webhookData.payment_type,
      status: webhookData.status,
      flwRef: webhookData.flw_ref,
      txRef: webhookData.tx_ref,
      transactionId: webhookData.id,
    };
  }
}
