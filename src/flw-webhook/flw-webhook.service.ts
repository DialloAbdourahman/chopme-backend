import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FlutterwaveWebhook,
  WebhookData,
} from 'src/common/interfaces/flutterwave/webhook';
import { EnumWebhookEventType } from 'src/common/enums/webhook-event-types';
import { EnumWebhookStatus } from 'src/common/enums/webhook-statuses';
import { Model, Types } from 'mongoose';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Order, OrderDocument } from 'src/orders/entities/order.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';

@Injectable()
export class FlwWebhookService {
  private readonly logger = new Logger(FlwWebhookService.name);

  constructor(
    @InjectModel(Menu.name) private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async processWebhook(webhook: FlutterwaveWebhook) {
    this.logger.log(
      `[FlwWebhookService] Received webhook event: ${webhook.event}, status: ${webhook.data?.status}, tx_ref: ${webhook.data?.tx_ref}`,
    );

    if (webhook.event === EnumWebhookEventType.CHARGE_COMPLETED) {
      this.logger.log(
        '[FlwWebhookService] Processing charge completed webhook',
        webhook.data,
      );
      if (webhook.data.status === EnumWebhookStatus.SUCCESSFUL) {
        await this.processSuccessfulPayment(webhook.data);
      } else if (webhook.data.status === EnumWebhookStatus.FAILED) {
        await this.processFailedPayment(webhook.data);
      } else {
        this.logger.warn(
          `[FlwWebhookService] Unhandled charge status: ${webhook.data.status}, tx_ref: ${webhook.data.tx_ref}`,
        );
      }
    } else {
      this.logger.warn(
        `[FlwWebhookService] Ignoring unsupported webhook event: ${webhook.event}`,
      );
    }

    this.logger.log('[FlwWebhookService] Webhook processing completed');
    return 'This action adds a new flwWebhook';
  }

  private async processSuccessfulPayment(webhookData: WebhookData) {
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
    order.webhookDetails = {
      amount: webhookData.amount,
      appFee: webhookData.app_fee,
      chargedAmount: webhookData.charged_amount,
      currency: webhookData.currency,
      ip: webhookData.ip,
      merchantFee: webhookData.merchant_fee,
      paymentType: webhookData.payment_type,
      status: webhookData.status,
    };

    this.logger.log(
      `[FlwWebhookService] Saving order after successful payment: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[FlwWebhookService] Order saved successfully: id=${order._id}, status=${order.status}`,
    );

    this.logger.log(
      `[FlwWebhookService] Triggering background menu ordersCount update for order: id=${order._id}, items=${order.items.length}`,
    );
    this.incrementMenuOrdersCount(order);
  }

  private async processFailedPayment(webhookData: WebhookData) {
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
    order.webhookDetails = {
      amount: webhookData.amount,
      appFee: webhookData.app_fee,
      chargedAmount: webhookData.charged_amount,
      currency: webhookData.currency,
      ip: webhookData.ip,
      merchantFee: webhookData.merchant_fee,
      paymentType: webhookData.payment_type,
      status: webhookData.status,
    };

    this.logger.log(
      `[FlwWebhookService] Saving order after failed payment: id=${order._id}`,
    );
    await order.save();
    this.logger.log(
      `[FlwWebhookService] Order saved successfully: id=${order._id}, status=${order.status}`,
    );
  }

  private async incrementMenuOrdersCount(order: OrderDocument) {
    this.logger.log(
      `[FlwWebhookService] Incrementing ordersCount for ${order.items.length} menu(s) from order: id=${order._id}`,
    );

    for (const item of order.items) {
      try {
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
      } catch (error) {
        this.logger.error(
          `[FlwWebhookService] Failed to update menu ordersCount: productId=${item.product}, orderId=${order._id}`,
          error.message,
        );
      }
    }

    this.logger.log(
      `[FlwWebhookService] Background menu ordersCount update completed for order: id=${order._id}`,
    );
  }
}
