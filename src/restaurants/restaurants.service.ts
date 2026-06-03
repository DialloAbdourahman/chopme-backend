import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CreateRestaurantDto } from './dto/input/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/input/update-restaurant.dto';
import { Restaurant, RestaurantDocument } from './entities/restaurant.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import {
  RestaurantMember,
  RestaurantMemberDocument,
} from './entities/restaurant-member.entity';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumAuthType } from 'src/common/enums/auth-types';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import * as bcrypt from 'bcrypt';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { plainToInstance } from 'class-transformer';
import { RestaurantPublicOutputDto } from './dto/output/restaurant-output.dto';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async create(
    createRestaurantDto: CreateRestaurantDto,
    adminUser: ILoggedInUserTokenData,
  ) {
    this.logger.log('[create] Starting restaurant creation transaction');

    const normalizedName = createRestaurantDto.name.trim();
    const normalizedEmail = createRestaurantDto.email.toLowerCase().trim();
    const createdById = new Types.ObjectId(adminUser.id);

    const existingRestaurant = await this.restaurantModel.findOne({
      name: normalizedName,
    });

    if (existingRestaurant) {
      this.logger.log(
        `[create] Restaurant with name=${normalizedName} exists already`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.EXISTS_ALREADY,
        message: 'Restaurant with this name already exists',
      });
    }

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
      const {
        fullName,
        password,
        slogan,
        description,
        phone,
        restaurantEmail,
        address,
        pictures,
        deliveryPricingKm,
        availability,
      } = createRestaurantDto;

      const hashedPassword = await bcrypt.hash(password, 10);

      this.logger.log(
        `[create] Creating restaurant user with email=${normalizedEmail}`,
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
      this.logger.log(`[create] Created restaurant user id=${user._id}`);

      this.logger.log(`[create] Creating restaurant name=${normalizedName}`);

      const restaurant = new this.restaurantModel({
        name: normalizedName,
        slogan,
        description,
        phone,
        email: restaurantEmail,
        address,
        pictures: pictures ?? [],
        deliveryPricingKm: deliveryPricingKm ?? [],
        createdBy: createdById,
        availability: availability ?? [],
      });
      await restaurant.save({ session });
      this.logger.log(`[create] Created restaurant id=${restaurant._id}`);

      this.logger.log(
        `[create] Creating restaurant member for user id=${user._id} and restaurant id=${restaurant._id}`,
      );

      const restaurantId = restaurant._id;
      const restaurantUserId = user._id;

      const member = new this.restaurantMemberModel({
        restaurant: restaurantId,
        user: restaurantUserId,
        role: EnumRestaurantMemberRole.MANAGER,
        createdBy: createdById,
      });
      await member.save({ session });

      await session.commitTransaction();
      this.logger.log('[create] Restaurant creation transaction committed');

      const restaurantObject = restaurant.toObject();

      const publicRestaurant = plainToInstance(
        RestaurantPublicOutputDto,
        restaurantObject,
        {
          excludeExtraneousValues: true,
        },
      );

      return OrchestrationResult.Success<RestaurantPublicOutputDto>({
        statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
        data: publicRestaurant,
        message: 'Restaurant created successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[create] Error during restaurant creation: ${error?.message}`,
        error?.stack,
      );

      throw new OrchestrationException({
        statusCode: EnumStatusCode.UNABLE_TO_CREATE_ACCOUNT,
        message: 'Unable to create restaurant',
        code: 500,
      });
    } finally {
      session.endSession();
    }
  }

  async checkName(name: string) {
    const normalizedName = name.trim();

    const existingRestaurant = await this.restaurantModel.findOne({
      name: normalizedName,
    });

    const isAvailable = !existingRestaurant;

    if (!isAvailable) {
      this.logger.log(
        `[checkName] Restaurant with name=${normalizedName} exists already`,
      );
    }

    return OrchestrationResult.Success<{ available: boolean }>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: { available: isAvailable },
      message: isAvailable
        ? 'Restaurant name is available'
        : 'Restaurant name is already taken',
    });
  }

  findAll() {
    return `This action returns all restaurants`;
  }

  async findOne(idOrSlug: string) {
    this.logger.log(`[findOne] Finding restaurant by idOrSlug=${idOrSlug}`);

    const isObjectId = Types.ObjectId.isValid(idOrSlug);

    const query = isObjectId
      ? { _id: new Types.ObjectId(idOrSlug), deleted: false }
      : { slug: idOrSlug, deleted: false };

    const restaurant = await this.restaurantModel.findOne(query);

    if (!restaurant) {
      this.logger.log(
        `[findOne] Restaurant not found for idOrSlug=${idOrSlug}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPublicOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPublicOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Restaurant fetched successfully',
    });
  }

  update(id: number, updateRestaurantDto: UpdateRestaurantDto) {
    return `This action updates a #${id} restaurant`;
  }

  remove(id: number) {
    return `This action removes a #${id} restaurant`;
  }
}
