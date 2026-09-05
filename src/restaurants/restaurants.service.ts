import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CreateRestaurantDto } from './dto/input/create-restaurant.dto';
import {
  UpdateRestaurantDto,
  AdminUpdateRestaurantDto,
} from './dto/input/update-restaurant.dto';
import { Restaurant, RestaurantDocument } from './entities/restaurant.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import {
  RestaurantMember,
  RestaurantMemberDocument,
} from 'src/restaurant-members/entities/restaurant-member.entity';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumAuthType } from 'src/common/enums/auth-types';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import * as bcrypt from 'bcrypt';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { EnumNetwork } from 'src/common/enums/networks';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { plainToInstance } from 'class-transformer';
import {
  RestaurantPrivateOutputDto,
  RestaurantPublicOutputDto,
  RestaurantWalletOutputDto,
} from './dto/output/restaurant-output.dto';
import { AwsS3Helper } from 'src/common/aws/s3';
import { env } from 'src/config/env';
import type { Pagination } from 'src/common/interfaces/pagination';
import { FindRestaurantDto } from './dto/input/find-restaurant.dto';
import { AddRestaurantWalletDto } from './dto/input/restaurant-wallet.dto';
import { CameroonPhoneUtils } from 'src/common/utils/cameroon-phone-utils';
import { EnumWalletTypes } from 'src/common/enums/wallet-types';
import { Menu, MenuDocument } from 'src/menus/entities/menu.entity';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);
  private readonly s3Helper: AwsS3Helper;

  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Menu.name)
    private readonly menuModel: Model<MenuDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {
    this.s3Helper = new AwsS3Helper({
      bucketName: env.s3PublicBucketName,
      bucketRegion: env.s3PublicBucketRegion,
    });
  }

  private ensureUserCanManageRestaurant(
    restaurantId: string,
    user: ILoggedInUserTokenData,
    context: string,
  ) {
    if (user.role === EnumUserRole.ADMIN) {
      return;
    }

    if (!user.restaurantId || user.restaurantId !== restaurantId) {
      this.logger.log(
        `[${context}] User id=${user.id} is not allowed to update restaurant id=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_ALLOWED,
        message: 'You do not have permission to update this restaurant',
        code: 403,
      });
    }
  }

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
        deliveryPricingKm,
        availability,
        location,
        type,
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
        pictures: [],
        deliveryPricingKm: deliveryPricingKm ?? [],
        createdBy: createdById,
        availability: availability ?? [],
        location,
        type,
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
        role: EnumRestaurantMemberRole.OWNER,
        createdBy: createdById,
      });
      await member.save({ session });

      await session.commitTransaction();
      this.logger.log('[create] Restaurant creation transaction committed');

      const restaurantObject = restaurant.toObject();

      const publicRestaurant = plainToInstance(
        RestaurantPrivateOutputDto,
        restaurantObject,
        {
          excludeExtraneousValues: true,
        },
      );

      return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
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

  async findAll(filters: FindRestaurantDto, page: number, limit: number) {
    this.logger.log(`[findAll] Finding restaurants with filters`, filters);

    const {
      search,
      city,
      type,
      // onlyOpened,
      latitude,
      longitude,
      radiusKm,
    } = filters;

    const pipeline: any[] = [];

    // If geospatial search is requested, use $geoNear as first stage
    if (longitude && latitude && radiusKm) {
      const radiusMeters = radiusKm * 1000;
      pipeline.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)],
          },
          maxDistance: radiusMeters,
          spherical: true,
          distanceField: 'distance',
        },
      });
    }

    // Filter out deleted restaurants
    pipeline.push({
      $match: {
        deleted: false,
      },
    });

    // Sort by distance if geospatial search was used
    if (longitude && latitude && radiusKm) {
      pipeline.push({
        $sort: {
          distance: 1,
        },
      });
    }

    if (search) {
      pipeline.push(
        {
          $lookup: {
            from: 'menus',
            localField: '_id',
            foreignField: 'restaurant',
            as: 'menus',
          },
        },
        {
          $match: {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } },
              { slogan: { $regex: search, $options: 'i' } },
              { 'menus.name': { $regex: search, $options: 'i' } },
            ],
          },
        },
      );
    }

    // Only apply city filter if not using geospatial search
    if (!longitude && !latitude && city) {
      pipeline.push({
        $match: {
          $or: [
            { 'address.city': { $regex: city, $options: 'i' } },
            { 'address.country': { $regex: city, $options: 'i' } },
            { 'address.countryCode': { $regex: city, $options: 'i' } },
            { 'address.longName': { $regex: city, $options: 'i' } },
          ],
        },
      });
    }

    if (type) {
      pipeline.push({
        $match: {
          type,
        },
      });
    }

    // if (onlyOpened) {
    //   pipeline.push({
    //     $match: {
    //       isClosed: false,
    //     },
    //   });
    // }

    this.logger.log(`[findAll] Finding restaurants with filters`, pipeline);

    // Get total count
    const countPipeline = [...pipeline, { $count: 'count' }];
    const [countResult] = await this.restaurantModel.aggregate(countPipeline);
    const totalItems = countResult?.count || 0;

    // Get paginated items
    const itemsPipeline = [
      ...pipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    const restaurants = await this.restaurantModel.aggregate(itemsPipeline);

    const totalPages = Math.ceil(totalItems / limit);

    const publicRestaurants = plainToInstance(
      RestaurantPublicOutputDto,
      restaurants,
      {
        excludeExtraneousValues: true,
      },
    );

    const paginatedResult: Pagination<RestaurantPublicOutputDto> = {
      items: publicRestaurants,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<RestaurantPublicOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Restaurants retrieved successfully',
    });
  }

  async findAllForAdmin(filters: {
    search?: string;
    type?: string;
    page: number;
    limit: number;
    deleted?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    this.logger.log(`[findAllForAdmin] Finding restaurants for admin`, filters);

    const { search, type, page, limit, deleted, sortBy, sortOrder } = filters;

    const query: any = {
      deleted: deleted ?? false,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { slogan: { $regex: search, $options: 'i' } },
      ];
    }

    if (type) {
      query.type = type;
    }

    const totalItems = await this.restaurantModel.countDocuments(query);

    const sort: any = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    const restaurants = await this.restaurantModel
      .find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalItems / limit);

    const privateRestaurants = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurants,
      {
        excludeExtraneousValues: true,
      },
    );

    const paginatedResult: Pagination<RestaurantPrivateOutputDto> = {
      items: privateRestaurants,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<RestaurantPrivateOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Restaurants retrieved successfully',
    });
  }

  async findOne(idOrSlug: string, longitude?: number, latitude?: number) {
    this.logger.log(`[findOne] Finding restaurant by idOrSlug=${idOrSlug}`);

    const isObjectId = Types.ObjectId.isValid(idOrSlug);

    const query = isObjectId
      ? { _id: new Types.ObjectId(idOrSlug), deleted: false }
      : { slug: idOrSlug, deleted: false };

    let restaurantObject: Record<string, any> | undefined;

    // If coordinates are provided, compute the distance with $geoNear
    if (longitude !== undefined && latitude !== undefined) {
      const [result] = await this.restaurantModel.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            spherical: true,
            distanceField: 'distance',
            query,
          },
        },
        { $limit: 1 },
      ]);
      restaurantObject = result;
    } else {
      const restaurant = await this.restaurantModel.findOne(query);
      restaurantObject = restaurant?.toObject();
    }

    if (!restaurantObject) {
      this.logger.log(
        `[findOne] Restaurant not found for idOrSlug=${idOrSlug}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

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

  async findOnePrivate({
    idOrSlug,
    user,
    considerDelete = false,
  }: {
    idOrSlug: string;
    user: ILoggedInUserTokenData;
    considerDelete?: boolean;
  }) {
    this.logger.log(
      `[findOnePrivate] Finding restaurant by idOrSlug=${idOrSlug}`,
    );

    const isObjectId = Types.ObjectId.isValid(idOrSlug);

    const query: Record<string, any> = isObjectId
      ? { _id: new Types.ObjectId(idOrSlug) }
      : { slug: idOrSlug };

    if (!considerDelete) {
      query.deleted = false;
    }

    const restaurant = await this.restaurantModel.findOne(query);

    if (!restaurant) {
      this.logger.log(
        `[findOnePrivate] Restaurant not found for idOrSlug=${idOrSlug}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    this.ensureUserCanManageRestaurant(
      restaurant._id.toString(),
      user,
      'findOnePrivate',
    );

    const privateRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurant.toObject(),
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: privateRestaurant,
      message: 'Restaurant fetched successfully',
    });
  }

  async incrementTotalViews(idOrSlug: string) {
    this.logger.log(
      `[incrementTotalViews] Incrementing totalViews for restaurant idOrSlug=${idOrSlug}`,
    );

    const isObjectId = Types.ObjectId.isValid(idOrSlug);

    const query = isObjectId
      ? { _id: new Types.ObjectId(idOrSlug), deleted: false }
      : { slug: idOrSlug, deleted: false };

    const restaurant = await this.restaurantModel.findOneAndUpdate(
      query,
      { $inc: { totalViews: 1 } },
      { new: true },
    );

    if (!restaurant) {
      this.logger.log(
        `[incrementTotalViews] Restaurant not found for idOrSlug=${idOrSlug}`,
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
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Restaurant views incremented successfully',
    });
  }

  async update(
    restaurantId: string,
    updateRestaurantDto: UpdateRestaurantDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[update] Updating restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(restaurantId, user, 'update');

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(`[update] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    const {
      slogan,
      description,
      phone,
      restaurantEmail,
      pictures,
      deliveryPricingKm,
      availability,
    } = updateRestaurantDto;

    if (slogan !== undefined) {
      restaurant.slogan = slogan;
    }
    if (description !== undefined) {
      restaurant.description = description;
    }
    if (phone !== undefined) {
      restaurant.phone = phone;
    }
    if (restaurantEmail !== undefined) {
      restaurant.email = restaurantEmail;
    }
    if (pictures !== undefined) {
      restaurant.pictures = pictures;
    }
    if (deliveryPricingKm !== undefined) {
      restaurant.deliveryPricingKm = deliveryPricingKm;
    }
    if (availability !== undefined) {
      restaurant.availability = availability;
    }

    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Restaurant updated successfully',
    });
  }

  async adminUpdate(
    restaurantId: string,
    adminUpdateRestaurantDto: AdminUpdateRestaurantDto,
    adminUser: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[adminUpdate] Admin updating restaurant id=${restaurantId} by admin email=${adminUser.email}`,
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(`[adminUpdate] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    const { name, address, location, type } = adminUpdateRestaurantDto;

    if (name !== undefined) {
      restaurant.name = name.trim();
    }
    if (address !== undefined) {
      restaurant.address = address;
    }
    if (location !== undefined) {
      restaurant.location = location;
    }
    if (type !== undefined) {
      restaurant.type = type;
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      await restaurant.save({ session });
      this.logger.log(`[adminUpdate] Restaurant updated id=${restaurantId}`);

      await this.menuModel.updateMany(
        { restaurant: restaurant._id },
        {
          $set: {
            location: restaurant.location,
          },
        },
        { session },
      );
      this.logger.log(
        `[adminUpdate] Menus updated for restaurant id=${restaurantId}`,
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[create] Error during restaurant update: ${error?.message}`,
        error?.stack,
      );

      throw new OrchestrationException({
        statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
        message: 'Unable to update restaurant',
        code: 500,
      });
    } finally {
      session.endSession();
    }

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Restaurant updated successfully',
    });
  }

  async toggleClosed(restaurantId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[toggleClosed] Toggling isClosed for restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(restaurantId, user, 'toggleClosed');

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(`[toggleClosed] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    restaurant.isClosed = !restaurant.isClosed;
    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Restaurant closing state updated successfully',
    });
  }

  async remove(restaurantId: string, adminUser: ILoggedInUserTokenData) {
    this.logger.log(
      `[remove] Soft deleting restaurant id=${restaurantId} by admin id=${adminUser.id}`,
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(`[remove] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    restaurant.deleted = true;
    restaurant.deletedAt = new Date();
    restaurant.deletedBy = new Types.ObjectId(adminUser.id);

    await restaurant.save();

    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: 'Restaurant deleted successfully',
      message: 'Restaurant deleted successfully',
    });
  }

  async restore(restaurantId: string, adminUser: ILoggedInUserTokenData) {
    this.logger.log(
      `[restore] Restoring restaurant id=${restaurantId} by admin id=${adminUser.id}`,
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: true,
    });

    if (!restaurant) {
      this.logger.log(`[restore] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    restaurant.deleted = false;
    restaurant.deletedAt = null;
    restaurant.deletedBy = null;

    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Restaurant restored successfully',
    });
  }

  async uploadRestaurantImage(
    restaurantId: string,
    file: Express.Multer.File,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[uploadRestaurantImage] Uploading image for restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(
      restaurantId,
      user,
      'uploadRestaurantImage',
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(
        `[uploadRestaurantImage] Restaurant not found id=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (restaurant.pictures.length >= env.maxRestaurantImages) {
      this.logger.log(
        `[uploadRestaurantImage] Restaurant id=${restaurantId} has reached maximum image limit of ${env.maxRestaurantImages}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.MAX_IMAGES_REACHED,
        message: `Maximum image limit of ${env.maxRestaurantImages} reached`,
        code: 400,
      });
    }

    const fileExtension = file.originalname.split('.').pop();
    const key = `restaurants/${restaurantId}/images/${Date.now()}.${fileExtension}`;

    await this.s3Helper.uploadImage(key, file.mimetype, file.buffer);

    restaurant.pictures.push(key);
    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Image uploaded successfully',
    });
  }

  async uploadRestaurantCoverImage(
    restaurantId: string,
    file: Express.Multer.File,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[uploadRestaurantCoverImage] Uploading cover image for restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(
      restaurantId,
      user,
      'uploadRestaurantCoverImage',
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(
        `[uploadRestaurantCoverImage] Restaurant not found id=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    const fileExtension = file.originalname.split('.').pop();
    const key = `restaurants/${restaurantId}/cover/${Date.now()}.${fileExtension}`;

    await this.s3Helper.uploadImage(key, file.mimetype, file.buffer);

    restaurant.coverImage = key;
    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Cover image uploaded successfully',
    });
  }

  async deleteRestaurantImage(
    restaurantId: string,
    key: string,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[deleteRestaurantImage] Deleting image key=${key} for restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(
      restaurantId,
      user,
      'deleteRestaurantImage',
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(
        `[deleteRestaurantImage] Restaurant not found id=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (!restaurant.pictures.includes(key)) {
      this.logger.log(
        `[deleteRestaurantImage] Image key=${key} not found in restaurant id=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Image not found',
        code: 404,
      });
    }

    await this.s3Helper.deleteImageFromS3(key);

    restaurant.pictures = restaurant.pictures.filter((pic) => pic !== key);
    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Image deleted successfully',
    });
  }

  async deleteRestaurantCoverImage(
    restaurantId: string,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[deleteRestaurantCoverImage] Deleting cover image for restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(
      restaurantId,
      user,
      'deleteRestaurantCoverImage',
    );

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(
        `[deleteRestaurantCoverImage] Restaurant not found id=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (!restaurant.coverImage) {
      this.logger.log(
        `[deleteRestaurantCoverImage] Restaurant id=${restaurantId} has no cover image`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Cover image not found',
        code: 404,
      });
    }

    await this.s3Helper.deleteImageFromS3(restaurant.coverImage);

    restaurant.coverImage = undefined;
    await restaurant.save();

    const restaurantObject = restaurant.toObject();

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurantObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Cover image deleted successfully',
    });
  }

  async addWallet(
    restaurantId: string,
    dto: AddRestaurantWalletDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[addWallet] Adding wallet to restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(restaurantId, user, 'addWallet');

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
    });

    if (!restaurant) {
      this.logger.log(`[addWallet] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (restaurant.wallet) {
      this.logger.log(
        `[addWallet] Restaurant id=${restaurantId} already has a wallet`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.WALLET_EXISTS_ALREADY,
        message: 'Restaurant already has a wallet',
        code: 400,
      });
    }

    let mobileData: { network: EnumNetwork; number: string } | undefined;

    if (dto.type === EnumWalletTypes.MOBILE_WALLET && dto.number) {
      const network = CameroonPhoneUtils.getOperator(dto.number);

      if (network === EnumNetwork.UNKNOWN) {
        this.logger.warn(
          `[addWallet] Unknown network for phone number: ${dto.number}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INVALID_PHONE_NUMBER,
          message: 'Unable to determine mobile network operator',
          code: 400,
        });
      }

      mobileData = {
        network,
        number: dto.number,
      };
    }

    if (dto.type === EnumWalletTypes.MOBILE_WALLET) {
      restaurant.wallet = {
        type: dto.type,
        mobileData,
      };
    }

    await restaurant.save();

    this.logger.log(
      `[addWallet] Wallet added to restaurant id=${restaurantId}`,
    );

    const publicRestaurant = plainToInstance(
      RestaurantWalletOutputDto,
      restaurant.toObject(),
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantWalletOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Wallet added successfully',
    });
  }

  async removeWallet(restaurantId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[removeWallet] Removing wallet from restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(restaurantId, user, 'removeWallet');

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
    });

    if (!restaurant) {
      this.logger.log(`[removeWallet] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (!restaurant.wallet) {
      this.logger.log(
        `[removeWallet] Restaurant id=${restaurantId} has no wallet`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'No wallet found for this restaurant',
        code: 404,
      });
    }

    restaurant.wallet = undefined;
    await restaurant.save();

    this.logger.log(
      `[removeWallet] Wallet removed from restaurant id=${restaurantId}`,
    );

    const publicRestaurant = plainToInstance(
      RestaurantPrivateOutputDto,
      restaurant.toObject(),
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantPrivateOutputDto>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: publicRestaurant,
      message: 'Wallet removed successfully',
    });
  }

  async getWallet(restaurantId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[getWallet] Fetching wallet for restaurant id=${restaurantId} by user id=${user.id}`,
    );

    this.ensureUserCanManageRestaurant(restaurantId, user, 'getWallet');

    const restaurant = await this.restaurantModel.findOne({
      _id: new Types.ObjectId(restaurantId),
    });

    if (!restaurant) {
      this.logger.log(`[getWallet] Restaurant not found id=${restaurantId}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    if (!restaurant.wallet) {
      this.logger.log(
        `[getWallet] Restaurant id=${restaurantId} has no wallet`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'No wallet found for this restaurant',
        code: 404,
      });
    }

    this.logger.log(
      `[getWallet] Wallet found for restaurant id=${restaurantId}`,
    );

    const publicWallet = plainToInstance(
      RestaurantWalletOutputDto,
      restaurant,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantWalletOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicWallet,
      message: 'Wallet fetched successfully',
    });
  }
}
