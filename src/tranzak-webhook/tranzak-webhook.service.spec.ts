import { Test, TestingModule } from '@nestjs/testing';
import { TranzakWebhookService } from './tranzak-webhook.service';

describe('TranzakWebhookService', () => {
  let service: TranzakWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranzakWebhookService],
    }).compile();

    service = module.get<TranzakWebhookService>(TranzakWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
