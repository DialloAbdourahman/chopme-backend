import { Test, TestingModule } from '@nestjs/testing';
import { FlwWebhookController } from './flw-webhook.controller';
import { FlwWebhookService } from './flw-webhook.service';

describe('FlwWebhookController', () => {
  let controller: FlwWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlwWebhookController],
      providers: [FlwWebhookService],
    }).compile();

    controller = module.get<FlwWebhookController>(FlwWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
