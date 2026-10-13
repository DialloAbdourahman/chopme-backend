import { Test, TestingModule } from '@nestjs/testing';
import { TranzakWebhookController } from './tranzak-webhook.controller';
import { TranzakWebhookService } from './tranzak-webhook.service';

describe('TranzakWebhookController', () => {
  let controller: TranzakWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranzakWebhookController],
      providers: [TranzakWebhookService],
    }).compile();

    controller = module.get<TranzakWebhookController>(TranzakWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
