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
import { MenuPublicWithCompleteRestaurantOutputDto } from './dto/output/menu-output.dto';
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Menu created successfully',
      },
    );
  }

  async search({
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
    this.logger.log(
      `[search] Searching menus with filters: search=${search}, page=${page}, limit=${limit}, restaurantId=${restaurantId}`,
    );

    if (!Types.ObjectId.isValid(restaurantId) || !restaurantId) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.INVALID_REQUEST,
        message: 'Invalid restaurantId',
      });
    }

    const pipeline: any[] = [];

    pipeline.push({
      $match: {
        restaurant: new Types.ObjectId(restaurantId),
        deleted: false,
      },
    });

    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) {
        return OrchestrationResult.Failure<string>({
          statusCode: EnumStatusCode.INVALID_REQUEST,
          message: 'Invalid categoryId',
        });
      }

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

    const publicMenus = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menus,
      {
        excludeExtraneousValues: true,
      },
    );

    const paginatedResult: Pagination<MenuPublicWithCompleteRestaurantOutputDto> =
      {
        items: publicMenus,
        page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      };

    return OrchestrationResult.Success<
      Pagination<MenuPublicWithCompleteRestaurantOutputDto>
    >({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Menus fetched successfully',
    });
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Menu fetched successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Menu updated successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Menu restored successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Menu availability updated successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Image uploaded successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Cover image uploaded successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Image deleted successfully',
      },
    );
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

    const publicMenu = plainToInstance(
      MenuPublicWithCompleteRestaurantOutputDto,
      menuObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<MenuPublicWithCompleteRestaurantOutputDto>(
      {
        statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
        data: publicMenu,
        message: 'Cover image deleted successfully',
      },
    );
  }
}
