import { Test, TestingModule } from '@nestjs/testing';
import { FlwWebhookService } from './flw-webhook.service';

describe('FlwWebhookService', () => {
  let service: FlwWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlwWebhookService],
    }).compile();

    service = module.get<FlwWebhookService>(FlwWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
