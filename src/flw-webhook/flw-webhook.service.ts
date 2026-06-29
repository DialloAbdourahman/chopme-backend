import { Injectable } from '@nestjs/common';
import { WebhookData } from 'src/common/interfaces/flutterwave/webhook';

@Injectable()
export class FlwWebhookService {
  processWebhook(webhook: WebhookData) {
    return 'This action adds a new flwWebhook';
  }
}
