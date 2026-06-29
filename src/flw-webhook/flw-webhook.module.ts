import { Module } from '@nestjs/common';
import { FlwWebhookService } from './flw-webhook.service';
import { FlwWebhookController } from './flw-webhook.controller';

@Module({
  controllers: [FlwWebhookController],
  providers: [FlwWebhookService],
})
export class FlwWebhookModule {}
