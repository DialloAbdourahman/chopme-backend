import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantMembersController } from './restaurant-members.controller';
import { RestaurantMembersService } from './restaurant-members.service';

describe('RestaurantMembersController', () => {
  let controller: RestaurantMembersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantMembersController],
      providers: [RestaurantMembersService],
    }).compile();

    controller = module.get<RestaurantMembersController>(RestaurantMembersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
