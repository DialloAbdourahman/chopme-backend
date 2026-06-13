import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CreateRestaurantMemberDto } from './dto/input/create-restaurant-member.dto';
import { UpdateRestaurantMemberDto } from './dto/input/update-restaurant-member.dto';
import {
  RestaurantMember,
  RestaurantMemberDocument,
} from './entities/restaurant-member.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { plainToInstance } from 'class-transformer';
import { RestaurantMemberPublicOutputDto } from './dto/output/restaurant-member-output.dto';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumAuthType } from 'src/common/enums/auth-types';
import * as bcrypt from 'bcrypt';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';

@Injectable()
export class RestaurantMembersService {
  private readonly logger = new Logger(RestaurantMembersService.name);

  constructor(
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async create(
    createRestaurantMemberDto: CreateRestaurantMemberDto,
    managerUser: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[create] Starting restaurant member creation by manager user id=${managerUser.id}, restaurantId=${managerUser.restaurantId}`,
    );

    if (!managerUser.restaurantId) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_ALLOWED,
        message: 'You are not associated with any restaurant',
        code: 403,
      });
    }

    const normalizedEmail = createRestaurantMemberDto.email
      .toLowerCase()
      .trim();
    const createdById = new Types.ObjectId(managerUser.id);
    const restaurantId = new Types.ObjectId(managerUser.restaurantId);

    const existingUser = await this.userModel.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      this.logger.log(
        `[create] User with email=${normalizedEmail} exists already`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.USER_ALREADY_EXISTS,
        message: 'User with this email already exists',
      });
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const { fullName, password, role } = createRestaurantMemberDto;

      const hashedPassword = await bcrypt.hash(password, 10);

      this.logger.log(
        `[create] Creating restaurant member user with email=${normalizedEmail}`,
      );

      const user = new this.userModel({
        fullName,
        email: normalizedEmail,
        password: hashedPassword,
        role: EnumUserRole.RESTAURANT_MEMBER,
        authType: EnumAuthType.EMAIL_PASSWORD,
        active: true,
        createdBy: createdById,
      });
      await user.save({ session });
      this.logger.log(`[create] Created restaurant member user id=${user._id}`);

      this.logger.log(
        `[create] Creating restaurant member for user id=${user._id} and restaurant id=${restaurantId}`,
      );

      const member = new this.restaurantMemberModel({
        restaurant: restaurantId,
        user: user._id,
        role,
        createdBy: createdById,
      });
      await member.save({ session });

      await session.commitTransaction();
      this.logger.log(
        '[create] Restaurant member creation transaction committed',
      );

      const memberObject = member.toObject();

      const publicMember = plainToInstance(
        RestaurantMemberPublicOutputDto,
        memberObject,
        {
          excludeExtraneousValues: true,
        },
      );

      return OrchestrationResult.Success<RestaurantMemberPublicOutputDto>({
        statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
        data: publicMember,
        message: 'Restaurant member created successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[create] Error during restaurant member creation: ${error?.message}`,
        error?.stack,
      );

      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_CREATE_ACCOUNT,
        message: 'Unable to create restaurant member',
        code: 500,
      });
    } finally {
      session.endSession();
    }
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
