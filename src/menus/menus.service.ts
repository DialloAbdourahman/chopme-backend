import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMenuDto } from './dto/input/create-menu.dto';
import { UpdateMenuDto } from './dto/input/update-menu.dto';
import { Menu, MenuDocument } from './entities/menu.entity';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { plainToInstance } from 'class-transformer';
import {
  MenuPrivateOutputDto,
  MenuPublicOutputDto,
} from './dto/output/menu-output.dto';
import {
  Category,
  CategoryDocument,
} from 'src/categories/entities/category.entity';
import { AwsS3Helper } from 'src/common/aws/s3';
import { env } from 'src/config/env';
import { Pagination } from 'src/common/interfaces/pagination';
import {
  Restaurant,
  RestaurantDocument,
} from 'src/restaurants/entities/restaurant.entity';
import { Order, OrderDocument } from 'src/orders/entities/order.entity';
import { EnumOrderStatus } from 'src/common/enums/order-status';

@Injectable()
export class MenusService {
  private readonly logger = new Logger(MenusService.name);
  private readonly s3Helper: AwsS3Helper;

  constructor(
    @InjectModel(Menu.name)
    private readonly menuModel: Model<MenuDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {
    this.s3Helper = new AwsS3Helper({
      bucketName: env.s3PublicBucketName,
      bucketRegion: env.s3PublicBucketRegion,
    });
  }

  async create(createMenuDto: CreateMenuDto, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[create] Creating menu for restaurantId=${user.restaurantId}`,
    );

    if (!user.restaurantId) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.NOT_ALLOWED,
        message: 'You are not associated with any restaurant',
      });
    }

    const restaurant = await this.restaurantModel.findOne({
      _id: user.restaurantId,
      deleted: false,
    });

    if (!restaurant) {
      this.logger.log(
        `[create] Restaurant with id categoryId=${createMenuDto.category} does not exist`,
      );
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.RESTAURANT_NOT_FOUND,
        message: 'Restaurant does not exist',
      });
    }

    const category = await this.categoryModel.findOne({
      _id: createMenuDto.category,
      deleted: false,
      restaurant: restaurant._id,
    });

    if (!category) {
      this.logger.log(
        `[create] Category wit id categoryId=${createMenuDto.category} does not exist`,
      );
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.CATEGORY_DOES_NOT_EXIST,
        message: 'You are not associated with any restaurant',
      });
    }

    const menu = await this.menuModel.create({
      restaurant,
      name: createMenuDto.name,
      category,
      description: createMenuDto.description,
      createdBy: new Types.ObjectId(user.id),
      price: createMenuDto.price,
      available:
        typeof createMenuDto.available === 'boolean'
          ? createMenuDto.available
          : true,
      location: restaurant.location,
    });

    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu created successfully',
    });
  }

  async searchPublic({
    search,
    page,
    limit,
    restaurantId,
    categoryId,
  }: {
    search?: string;
    page: number;
    limit: number;
    restaurantId: string;
    categoryId?: string;
  }) {
    if (!Types.ObjectId.isValid(restaurantId) || !restaurantId) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.INVALID_REQUEST,
        message: 'Invalid restaurantId',
      });
    }

    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.INVALID_REQUEST,
        message: 'Invalid categoryId',
      });
    }

    const { menus, totalItems, totalPages } = await this.executeSearch({
      search,
      page,
      limit,
      restaurantId,
      categoryId,
      deleted: false,
    });

    const publicMenus = plainToInstance(MenuPublicOutputDto, menus, {
      excludeExtraneousValues: true,
    });

    const paginatedResult: Pagination<MenuPublicOutputDto> = {
      items: publicMenus,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<MenuPublicOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Menus fetched successfully',
    });
  }

  async searchPrivate({
    search,
    page,
    limit,
    restaurantId,
    categoryId,
    deleted = false,
  }: {
    search?: string;
    page: number;
    limit: number;
    restaurantId: string;
    categoryId?: string;
    deleted?: boolean;
  }) {
    if (!Types.ObjectId.isValid(restaurantId) || !restaurantId) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.INVALID_REQUEST,
        message: 'Invalid restaurantId',
      });
    }

    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.INVALID_REQUEST,
        message: 'Invalid categoryId',
      });
    }

    const { menus, totalItems, totalPages } = await this.executeSearch({
      search,
      page,
      limit,
      restaurantId,
      categoryId,
      deleted,
    });

    const privateMenus = plainToInstance(MenuPrivateOutputDto, menus, {
      excludeExtraneousValues: true,
    });

    const paginatedResult: Pagination<MenuPrivateOutputDto> = {
      items: privateMenus,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<MenuPrivateOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Menus fetched successfully',
    });
  }

  private async executeSearch({
    search,
    page,
    limit,
    restaurantId,
    categoryId,
    deleted,
  }: {
    search?: string;
    page: number;
    limit: number;
    restaurantId: string;
    categoryId?: string;
    deleted: boolean;
  }) {
    this.logger.log(
      `[search] Searching menus with filters: search=${search}, page=${page}, limit=${limit}, restaurantId=${restaurantId}, deleted=${deleted}`,
    );

    const pipeline: any[] = [];

    pipeline.push({
      $match: {
        restaurant: new Types.ObjectId(restaurantId),
        deleted,
      },
    });

    if (categoryId) {
      pipeline.push({
        $match: {
          category: new Types.ObjectId(categoryId),
        },
      });
    }

    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category',
      },
    });

    pipeline.push({
      $unwind: '$category',
    });

    pipeline.push({
      $lookup: {
        from: 'restaurants',
        localField: 'restaurant',
        foreignField: '_id',
        as: 'restaurant',
      },
    });

    pipeline.push({
      $unwind: '$restaurant',
    });

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    this.logger.log(`[search] Searching menus with pipeline`, pipeline);

    // Get total count
    const countPipeline = [...pipeline, { $count: 'count' }];
    const [countResult] = await this.menuModel.aggregate(countPipeline);
    const totalItems = countResult?.count || 0;

    // Get paginated items
    const itemsPipeline = [
      ...pipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    const menus = await this.menuModel.aggregate(itemsPipeline);

    const totalPages = Math.ceil(totalItems / limit);

    return { menus, totalItems, totalPages };
  }

  async findOne(id: string) {
    this.logger.log(`[findOne] Finding menu by id=${id}`);

    if (!Types.ObjectId.isValid(id)) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    const menu = await this.menuModel
      .findOne({
        _id: new Types.ObjectId(id),
        deleted: false,
      })
      .populate(['category', 'restaurant']);

    if (!menu) {
      this.logger.log(`[findOne] Menu not found for id=${id}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPublicOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPublicOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu fetched successfully',
    });
  }

  async findOnePrivate(id: string, user: ILoggedInUserTokenData) {
    this.logger.log(`[findOnePrivate] Finding menu by id=${id}`);

    if (!Types.ObjectId.isValid(id)) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    const menu = await this.menuModel
      .findOne({
        _id: new Types.ObjectId(id),
        restaurant: new Types.ObjectId(user.restaurantId),
      })
      .populate(['category', 'restaurant']);

    if (!menu) {
      this.logger.log(`[findOnePrivate] Menu not found for id=${id}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    const menuObject = menu.toObject();

    const privateMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: privateMenu,
      message: 'Menu fetched successfully',
    });
  }

  async update(
    id: string,
    updateMenuDto: UpdateMenuDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(`[update] Updating menu id=${id} by user id=${user.id}`);

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[update] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    if (updateMenuDto.name !== undefined) {
      menu.name = updateMenuDto.name;
    }

    if (updateMenuDto.category !== undefined) {
      const category = await this.categoryModel.findOne({
        _id: updateMenuDto.category,
        deleted: false,
        restaurant: new Types.ObjectId(user.restaurantId),
      });

      if (!category) {
        this.logger.log(
          `[create] Category wit id categoryId=${updateMenuDto.category} does not exist`,
        );
        return OrchestrationResult.Failure<string>({
          statusCode: EnumStatusCode.CATEGORY_DOES_NOT_EXIST,
          message: 'You are not associated with any restaurant',
        });
      }
      menu.category = category;
    }

    if (updateMenuDto.description !== undefined) {
      menu.description = updateMenuDto.description;
    }

    if (updateMenuDto.price !== undefined) {
      menu.price = updateMenuDto.price;
    }

    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu updated successfully',
    });
  }

  async remove(id: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[remove] Soft deleting menu id=${id} by user id=${user.id}, restaurantId=${user.restaurantId}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[remove] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    menu.deleted = true;
    menu.deletedAt = new Date();
    menu.deletedBy = new Types.ObjectId(user.id);

    await menu.save();

    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: 'Menu deleted successfully',
      message: 'Menu deleted successfully',
    });
  }

  async restore(id: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[restore] Restoring menu id=${id} by user id=${user.id}, restaurantId=${user.restaurantId}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: true,
    });

    if (!menu) {
      this.logger.log(
        `[restore] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    menu.deleted = false;
    menu.deletedAt = null;
    menu.deletedBy = null;

    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu restored successfully',
    });
  }

  async toggleAvailable(id: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[toggleAvailable] Toggling available for menu id=${id} by user id=${user.id}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[toggleAvailable] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    menu.available = !menu.available;
    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu availability updated successfully',
    });
  }

  async uploadMenuImage(
    menuId: string,
    file: Express.Multer.File,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[uploadMenuImage] Uploading image for menu id=${menuId} by user id=${user.id}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(menuId),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[uploadMenuImage] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${menuId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    if (menu.pictures.length >= env.maxRestaurantImages) {
      this.logger.log(
        `[uploadMenuImage] Menu id=${menuId} has reached maximum image limit of ${env.maxRestaurantImages}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.MAX_IMAGES_REACHED,
        message: `Maximum image limit of ${env.maxRestaurantImages} reached`,
        code: 400,
      });
    }

    const fileExtension = file.originalname.split('.').pop();
    const key = `restaurants/${user.restaurantId}/menus/${menuId}/images/${Date.now()}.${fileExtension}`;

    await this.s3Helper.uploadImage(key, file.mimetype, file.buffer);

    menu.pictures.push(key);
    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Image uploaded successfully',
    });
  }

  async uploadMenuCoverImage(
    menuId: string,
    file: Express.Multer.File,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[uploadMenuCoverImage] Uploading cover image for menu id=${menuId} by user id=${user.id}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(menuId),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[uploadMenuCoverImage] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${menuId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    const fileExtension = file.originalname.split('.').pop();
    const key = `restaurants/${user.restaurantId}/menus/${menuId}/cover/${Date.now()}.${fileExtension}`;

    await this.s3Helper.uploadImage(key, file.mimetype, file.buffer);

    menu.coverImage = key;
    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Cover image uploaded successfully',
    });
  }

  async deleteMenuImage(
    menuId: string,
    key: string,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[deleteMenuImage] Deleting image key=${key} for menu id=${menuId} by user id=${user.id}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(menuId),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[deleteMenuImage] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${menuId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    if (!menu.pictures.includes(key)) {
      this.logger.log(
        `[deleteMenuImage] Image key=${key} not found in menu id=${menuId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Image not found',
        code: 404,
      });
    }

    await this.s3Helper.deleteImageFromS3(key);

    menu.pictures = menu.pictures.filter((picture) => picture !== key);
    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Image deleted successfully',
    });
  }

  async deleteMenuCoverImage(menuId: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[deleteMenuCoverImage] Deleting cover image for menu id=${menuId} by user id=${user.id}`,
    );

    const menu = await this.menuModel.findOne({
      _id: new Types.ObjectId(menuId),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!menu) {
      this.logger.log(
        `[deleteMenuCoverImage] Menu not found or not owned by restaurantId=${user.restaurantId}, id=${menuId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Menu not found',
        code: 404,
      });
    }

    if (!menu.coverImage) {
      this.logger.log(
        `[deleteMenuCoverImage] Menu id=${menuId} has no cover image`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Cover image not found',
        code: 404,
      });
    }

    await this.s3Helper.deleteImageFromS3(menu.coverImage);

    menu.coverImage = undefined;
    await menu.save();
    await menu.populate(['category', 'restaurant']);

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPrivateOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPrivateOutputDto>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Cover image deleted successfully',
    });
  }

  async getMenuOrderStats({
    user,
    startDate,
    endDate,
  }: {
    user: ILoggedInUserTokenData;
    startDate: string;
    endDate: string;
  }) {
    this.logger.log(
      `[getMenuOrderStats] Getting menu order stats for restaurantId=${user.restaurantId}, startDate=${startDate}, endDate=${endDate}`,
    );

    const restaurantId = new Types.ObjectId(user.restaurantId);

    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    if (
      (parsedStartDate && isNaN(parsedStartDate.getTime())) ||
      (parsedEndDate && isNaN(parsedEndDate.getTime()))
    ) {
      this.logger.warn(
        `[getMenuOrderStats] Invalid date range: startDate=${startDate}, endDate=${endDate}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_REQUEST,
        message: 'Invalid startDate or endDate',
        code: 400,
      });
    }

    const paidAtFilter: Record<string, Date> = {};
    if (parsedStartDate) paidAtFilter.$gte = parsedStartDate;
    if (parsedEndDate) paidAtFilter.$lt = parsedEndDate;

    const match: Record<string, unknown> = {
      restaurant: restaurantId,
      status: { $ne: EnumOrderStatus.CANCELLED_BY_RESTAURANT },
      paidAt: { $ne: null, ...paidAtFilter },
    };

    const stats = await this.orderModel.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
    ]);

    const menus = await this.menuModel
      .find({ restaurant: restaurantId, deleted: false })
      .exec();

    const statsMap = new Map(
      stats.map((stat) => [stat._id.toString(), stat.totalQuantity]),
    );

    const result = menus.map((menu) => ({
      menuId: menu._id.toString(),
      menuName: menu.name,
      totalOrders: statsMap.get(menu._id.toString()) ?? 0,
    }));

    this.logger.log(
      `[getMenuOrderStats] Computed stats for ${result.length} menus`,
    );

    return OrchestrationResult.Success<
      { menuId: string; menuName: string; totalOrders: number }[]
    >({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: result,
      message: 'Menu order stats fetched successfully',
    });
  }
}
