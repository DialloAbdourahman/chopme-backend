import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketService } from './web-socket-service';

describe('WebSocketService', () => {
  let provider: WebSocketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketService],
    }).compile();

    provider = module.get<WebSocketService>(WebSocketService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
