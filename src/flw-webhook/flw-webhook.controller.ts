import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FlwWebhookService } from './flw-webhook.service';
import { WebhookData } from 'src/common/interfaces/flutterwave/webhook';
import { env } from 'src/config/env';

@Controller('flw-webhook')
export class FlwWebhookController {
  constructor(private readonly flwWebhookService: FlwWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() body: any, @Headers('verif-hash') signature: string) {
    if (!signature || signature !== env.flutterWaveWebhookSecretHash) {
      throw new UnauthorizedException('Invalid Flutterwave signature');
    }

    const data = body as WebhookData;
    return this.flwWebhookService.processWebhook(data);
  }
}
