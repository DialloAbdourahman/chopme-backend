import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { TranzakWebhookService } from './tranzak-webhook.service';
import { ITranzakWebhookResponse } from 'src/common/interfaces/tranzak/response';
import { env } from 'src/config/env';

@Controller('tranzak-webhook')
export class TranzakWebhookController {
  private readonly logger = new Logger(TranzakWebhookController.name);

  constructor(private readonly tranzakWebhookService: TranzakWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() body: any) {
    const data = body as ITranzakWebhookResponse<unknown>;

    if (!data.authKey || data.authKey !== env.tranzakWebhookAuthKey) {
      this.logger.log(
        '[TranzakWebhookController] invalid Tranzak webhook auth key',
      );
      throw new UnauthorizedException('Invalid Tranzak webhook auth key');
    }

    return this.tranzakWebhookService.processWebhook(data);
  }
}
