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
import { FlutterwaveWebhook } from 'src/common/interfaces/flutterwave/webhook';
import { env } from 'src/config/env';
import { Logger } from '@nestjs/common';

@Controller('flw-webhook')
export class FlwWebhookController {
  private readonly logger = new Logger(FlwWebhookController.name);

  constructor(private readonly flwWebhookService: FlwWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() body: any, @Headers('verif-hash') signature: string) {
    if (!signature || signature !== env.flutterWaveWebhookSecretHash) {
      this.logger.log('[FlwWebhookController] invalid Flutterwave signature');
      throw new UnauthorizedException('Invalid Flutterwave signature');
    }

    const data = body as FlutterwaveWebhook;
    return this.flwWebhookService.processWebhook(data);
  }
}
