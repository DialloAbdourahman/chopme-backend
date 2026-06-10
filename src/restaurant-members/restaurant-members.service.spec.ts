import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantMembersService } from './restaurant-members.service';

describe('RestaurantMembersService', () => {
  let service: RestaurantMembersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RestaurantMembersService],
    }).compile();

    service = module.get<RestaurantMembersService>(RestaurantMembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
