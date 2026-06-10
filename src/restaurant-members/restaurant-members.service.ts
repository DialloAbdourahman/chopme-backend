import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateRestaurantMemberDto } from './dto/input/create-restaurant-member.dto';
import { UpdateRestaurantMemberDto } from './dto/input/update-restaurant-member.dto';
import {
  RestaurantMember,
  RestaurantMemberDocument,
} from './entities/restaurant-member.entity';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { plainToInstance } from 'class-transformer';
import { RestaurantMemberPublicOutputDto } from './dto/output/restaurant-member-output.dto';

@Injectable()
export class RestaurantMembersService {
  private readonly logger = new Logger(RestaurantMembersService.name);

  constructor(
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
  ) {}
  create(createRestaurantMemberDto: CreateRestaurantMemberDto) {
    return 'This action adds a new restaurantMember';
  }

  findAll() {
    return `This action returns all restaurantMembers`;
  }

  async findOne(user: ILoggedInUserTokenData) {
    this.logger.log(
      `[findOne] Getting restaurant member profile for user id=${user.id}, restaurantMemberId=${user.restaurantMemberId}`,
    );

    if (!user.restaurantId || !user.restaurantMemberId) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_ALLOWED,
        message: 'You are not associated with any restaurant member',
        code: 403,
      });
    }

    const restaurantMember = await this.restaurantMemberModel
      .findOne({
        _id: new Types.ObjectId(user.restaurantMemberId),
        restaurant: new Types.ObjectId(user.restaurantId),
        deleted: false,
      })
      .populate('restaurant')
      .populate('user');

    if (!restaurantMember) {
      this.logger.log(
        `[findOne] Restaurant member not found or not in restaurantId=${user.restaurantId}, restaurantMemberId=${user.restaurantMemberId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant member not found',
        code: 404,
      });
    }

    const memberObject = restaurantMember.toObject();

    const publicMember = plainToInstance(
      RestaurantMemberPublicOutputDto,
      memberObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantMemberPublicOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicMember,
      message: 'Restaurant member retrieved successfully',
    });
  }

  update(id: number, updateRestaurantMemberDto: UpdateRestaurantMemberDto) {
    return `This action updates a #${id} restaurantMember`;
  }

  remove(id: number) {
    return `This action removes a #${id} restaurantMember`;
  }
}
