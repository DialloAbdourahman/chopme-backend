import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantRatingsService } from './restaurant-ratings.service';

describe('RestaurantRatingsService', () => {
  let service: RestaurantRatingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RestaurantRatingsService],
    }).compile();

    service = module.get<RestaurantRatingsService>(RestaurantRatingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
