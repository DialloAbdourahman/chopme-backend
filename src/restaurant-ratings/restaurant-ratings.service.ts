import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { UpdateRestaurantRatingDto } from './dto/input/update-restaurant-rating.dto';
import { CreateRestaurantRatingDto } from './dto/input/create-restaurant-rating.dto';
import {
  RestaurantRating,
  RestaurantRatingDocument,
} from './entities/restaurant-rating.entity';
import { Order, OrderDocument } from 'src/orders/entities/order.entity';
import { Client, ClientDocument } from 'src/clients/entities/client.entity';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { EnumOrderStatus } from 'src/common/enums/order-status';
import { Pagination } from 'src/common/interfaces/pagination';
import { RestaurantRatingOutputDto } from './dto/output/restaurant-rating-ouptut.dto';
import { ClientPublicWithUserOutputDto } from 'src/clients/dto/output/client-output.dto';
import {
  Restaurant,
  RestaurantDocument,
} from 'src/restaurants/entities/restaurant.entity';

@Injectable()
export class RestaurantRatingsService {
  private readonly logger = new Logger(RestaurantRatingsService.name);

  constructor(
    @InjectModel(RestaurantRating.name)
    private readonly ratingModel: Model<RestaurantRatingDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async create(
    restaurantId: string,
    dto: CreateRestaurantRatingDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[create] Rating request by clientId=${user.clientId} for restaurantId=${restaurantId}`,
    );

    const clientId = new Types.ObjectId(user.clientId);
    const restaurantObjectId = new Types.ObjectId(restaurantId);

    const completedStatuses = [
      EnumOrderStatus.DELIVERED,
      EnumOrderStatus.DISBURSED,
    ];

    const hasCompletedOrder = await this.orderModel.exists({
      client: clientId,
      restaurant: restaurantObjectId,
      status: { $in: completedStatuses },
    });

    if (!hasCompletedOrder) {
      this.logger.warn(
        `[create] No completed order found for clientId=${user.clientId}, restaurantId=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NO_COMPLETED_ORDER_FOR_RESTAURANT,
        message: 'You must have a completed order to rate this restaurant',
        code: 403,
      });
    }

    const existingRating = await this.ratingModel.findOne({
      client: clientId,
      restaurant: restaurantObjectId,
      deleted: false,
    });

    if (existingRating) {
      this.logger.warn(
        `[create] Rating already exists for clientId=${user.clientId}, restaurantId=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RATING_ALREADY_EXISTS,
        message: 'You have already rated this restaurant',
        code: 409,
      });
    }

    const rating = await this.ratingModel.create({
      client: clientId,
      restaurant: restaurantObjectId,
      rating: dto.rating,
      comment: dto.comment,
    });

    this.logger.log(
      `[create] Rating created: id=${rating._id}, restaurantId=${restaurantId}`,
    );

    this.logger.log(
      `[create] Update public restaurant rating values, restaurantId=${restaurantId}`,
    );

    await this.updateRestaurantRating(restaurantObjectId);

    const publicRating = plainToInstance(
      RestaurantRatingOutputDto,
      rating.toObject(),
      { excludeExtraneousValues: true },
    );

    return OrchestrationResult.Success<RestaurantRatingOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicRating,
      message: 'Rating created successfully',
    });
  }

  async update(
    ratingId: string,
    dto: UpdateRestaurantRatingDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[update] Rating update by clientId=${user.clientId} for ratingId=${ratingId}`,
    );

    const rating = await this.ratingModel.findOne({
      _id: new Types.ObjectId(ratingId),
      client: new Types.ObjectId(user.clientId),
      deleted: false,
    });

    if (!rating) {
      this.logger.warn(
        `[update] Rating not found or access denied: ratingId=${ratingId}, clientId=${user.clientId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RATING_NOT_FOUND,
        message: 'Rating not found',
        code: 404,
      });
    }

    if (dto.rating !== undefined) rating.rating = dto.rating;
    if (dto.comment !== undefined) rating.comment = dto.comment;

    await rating.save();

    this.logger.log(`[update] Rating updated: id=${rating._id}`);

    await this.updateRestaurantRating(rating.restaurant.toString());

    const publicRating = plainToInstance(
      RestaurantRatingOutputDto,
      rating.toObject(),
      { excludeExtraneousValues: true },
    );

    return OrchestrationResult.Success<RestaurantRatingOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicRating,
      message: 'Rating updated successfully',
    });
  }

  async remove(ratingId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[remove] Rating delete by clientId=${user.clientId} for ratingId=${ratingId}`,
    );

    const rating = await this.ratingModel.findOne({
      _id: new Types.ObjectId(ratingId),
      client: new Types.ObjectId(user.clientId),
      deleted: false,
    });

    if (!rating) {
      this.logger.warn(
        `[remove] Rating not found or access denied: ratingId=${ratingId}, clientId=${user.clientId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RATING_NOT_FOUND,
        message: 'Rating not found',
        code: 404,
      });
    }

    await rating.deleteOne();

    this.logger.log(`[remove] Rating deleted: id=${ratingId}`);

    await this.updateRestaurantRating(rating.restaurant.toString());

    return OrchestrationResult.Success<null>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: null,
      message: 'Rating deleted successfully',
    });
  }

  async getRestaurantRatings(
    restaurantId: string,
    page: number,
    limit: number,
  ) {
    this.logger.log(
      `[getRestaurantRatings] Fetching ratings for restaurantId=${restaurantId}, page=${page}, limit=${limit}`,
    );

    const restaurantObjectId = new Types.ObjectId(restaurantId);

    const totalItems = await this.ratingModel.countDocuments({
      restaurant: restaurantObjectId,
      deleted: false,
    });

    const ratings = await this.ratingModel
      .find({ restaurant: restaurantObjectId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalItems / limit) || 1;

    const publicRatings = plainToInstance(
      RestaurantRatingOutputDto,
      ratings.map((r) => r.toObject()),
      { excludeExtraneousValues: true },
    );

    const paginatedResult: Pagination<RestaurantRatingOutputDto> = {
      items: publicRatings,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<RestaurantRatingOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Ratings fetched successfully',
    });
  }

  private async updateRestaurantRating(restaurantId: Types.ObjectId | string) {
    const restaurantObjectId = new Types.ObjectId(restaurantId);

    this.logger.log(
      `[updateRestaurantRating] Recalculating ratings for restaurantId=${restaurantId}`,
    );

    const [aggregateResult] = await this.ratingModel.aggregate([
      { $match: { restaurant: restaurantObjectId, deleted: false } },
      {
        $group: {
          _id: '$restaurant',
          total: { $sum: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingCount = aggregateResult?.count ?? 0;
    const totalRatings = aggregateResult?.total ?? 0;
    const averageRating = ratingCount > 0 ? totalRatings / ratingCount : 0;

    await this.restaurantModel.findByIdAndUpdate(restaurantObjectId, {
      $set: {
        'rating.total': ratingCount,
        'rating.average': averageRating,
      },
    });

    this.logger.log(
      `[updateRestaurantRating] Restaurant rating recalculated: count=${ratingCount}, average=${averageRating}`,
    );
  }

  async getRatingClient(ratingId: string) {
    this.logger.log(
      `[getRatingClient] Fetching client for ratingId=${ratingId}`,
    );

    const rating = await this.ratingModel
      .findOne({ _id: new Types.ObjectId(ratingId), deleted: false })
      .populate({ path: 'client', populate: { path: 'user' } });

    if (!rating) {
      this.logger.warn(
        `[getRatingClient] Rating not found: ratingId=${ratingId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RATING_NOT_FOUND,
        message: 'Rating not found',
        code: 404,
      });
    }

    const client = rating.client as ClientDocument;

    if (!client) {
      this.logger.warn(
        `[getRatingClient] Client not found for ratingId=${ratingId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CLIENT_NOT_FOUND,
        message: 'Client not found',
        code: 404,
      });
    }

    this.logger.log(
      `[getRatingClient] Client found for ratingId=${ratingId}, clientId=${client._id}`,
    );

    const publicClient = plainToInstance(
      ClientPublicWithUserOutputDto,
      client.toObject(),
      { excludeExtraneousValues: true },
    );

    return OrchestrationResult.Success<ClientPublicWithUserOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicClient,
      message: 'Rating client fetched successfully',
    });
  }

  async getMyRating(restaurantId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[getMyRating] Fetching my rating for restaurantId=${restaurantId}, clientId=${user.clientId}`,
    );

    const rating = await this.ratingModel.findOne({
      client: new Types.ObjectId(user.clientId),
      restaurant: new Types.ObjectId(restaurantId),
      deleted: false,
    });

    if (!rating) {
      this.logger.warn(
        `[getMyRating] Rating not found for clientId=${user.clientId}, restaurantId=${restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.RATING_NOT_FOUND,
        message: 'You have not rated this restaurant yet',
        code: 404,
      });
    }

    this.logger.log(
      `[getMyRating] Rating found: id=${rating._id}, restaurantId=${restaurantId}`,
    );

    const publicRating = plainToInstance(
      RestaurantRatingOutputDto,
      rating.toObject(),
      { excludeExtraneousValues: true },
    );

    return OrchestrationResult.Success<RestaurantRatingOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicRating,
      message: 'My rating fetched successfully',
    });
  }
}
