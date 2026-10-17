import { Test, TestingModule } from '@nestjs/testing';
import { TranzakService } from './tranzak.service';

describe('TranzakService', () => {
  let service: TranzakService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranzakService],
    }).compile();

    service = module.get<TranzakService>(TranzakService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
