import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCategoryDto } from './dto/input/create-category.dto';
import { UpdateCategoryDto } from './dto/input/update-category.dto';
import { Category, CategoryDocument } from './entities/category.entity';
import { Menu, MenuDocument } from '../menus/entities/menu.entity';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { plainToInstance } from 'class-transformer';
import { CategoryPublicOutputDto } from './dto/output/category-output.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Menu.name)
    private readonly menuModel: Model<MenuDocument>,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[create] Creating category for restaurantId=${user.restaurantId}`,
    );

    if (!user.restaurantId) {
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.NOT_ALLOWED,
        message: 'You are not associated with any restaurant',
      });
    }

    const restaurantObjectId = new Types.ObjectId(user.restaurantId);
    const createdById = new Types.ObjectId(user.id);

    const category = await this.categoryModel.create({
      restaurant: restaurantObjectId,
      name: createCategoryDto.name,
      description: createCategoryDto.description,
      createdBy: createdById,
    });

    const categoryObject = category.toObject();

    const publicCategory = plainToInstance(
      CategoryPublicOutputDto,
      categoryObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<CategoryPublicOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicCategory,
      message: 'Category created successfully',
    });
  }

  async findAll(restaurantId: string) {
    this.logger.log(
      `[findAll] Listing categories for restaurantId=${restaurantId}`,
    );

    if (!Types.ObjectId.isValid(restaurantId)) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant not found',
        code: 404,
      });
    }

    const categories = await this.categoryModel
      .find({
        restaurant: new Types.ObjectId(restaurantId),
        deleted: false,
      })
      .sort({ name: 1 });

    const publicCategories = plainToInstance(
      CategoryPublicOutputDto,
      categories.map((category) => category.toObject()),
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<CategoryPublicOutputDto[]>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicCategories,
      message: 'Categories retrieved successfully',
    });
  }

  async findOne(id: string) {
    this.logger.log(`[findOne] Finding category by id=${id}`);

    if (!Types.ObjectId.isValid(id)) {
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Category not found',
        code: 404,
      });
    }

    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(id),
      deleted: false,
    });

    if (!category) {
      this.logger.log(`[findOne] Category not found for id=${id}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Category not found',
        code: 404,
      });
    }

    const categoryObject = category.toObject();

    const publicCategory = plainToInstance(
      CategoryPublicOutputDto,
      categoryObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<CategoryPublicOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicCategory,
      message: 'Category retrieved successfully',
    });
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    user: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[update] Updating category id=${id} by user id=${user.id}`,
    );

    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!category) {
      this.logger.log(
        `[update] Category not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Category not found',
        code: 404,
      });
    }

    if (updateCategoryDto.name !== undefined) {
      category.name = updateCategoryDto.name;
    }

    if (updateCategoryDto.description !== undefined) {
      category.description = updateCategoryDto.description;
    }

    await category.save();

    const categoryObject = category.toObject();

    const publicCategory = plainToInstance(
      CategoryPublicOutputDto,
      categoryObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<CategoryPublicOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicCategory,
      message: 'Category updated successfully',
    });
  }

  async remove(id: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[remove] Soft deleting category id=${id} by user id=${user.id}, restaurantId=${user.restaurantId}`,
    );

    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: false,
    });

    if (!category) {
      this.logger.log(
        `[remove] Category not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Category not found',
        code: 404,
      });
    }

    const menu = await this.menuModel.findOne({
      category: category._id,
      deleted: false,
    });

    if (menu) {
      this.logger.log(
        `[remove] Category id=${id} is used in menu id=${menu._id}`,
      );
      return OrchestrationResult.Failure<string>({
        statusCode: EnumStatusCode.CATEGORY_IN_USE,
        message: 'Category is used in one or more menus',
      });
    }

    category.deleted = true;
    category.deletedAt = new Date();
    category.deletedBy = new Types.ObjectId(user.id);

    await category.save();

    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
      data: 'Category deleted successfully',
      message: 'Category deleted successfully',
    });
  }

  async restore(id: string, user: ILoggedInUserTokenData) {
    this.logger.log(
      `[restore] Restoring category id=${id} by user id=${user.id}, restaurantId=${user.restaurantId}`,
    );

    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(id),
      restaurant: new Types.ObjectId(user.restaurantId),
      deleted: true,
    });

    if (!category) {
      this.logger.log(
        `[restore] Category not found or not owned by restaurantId=${user.restaurantId}, id=${id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Category not found',
        code: 404,
      });
    }

    category.deleted = false;
    category.deletedAt = null;
    category.deletedBy = null;

    await category.save();

    const categoryObject = category.toObject();

    const publicCategory = plainToInstance(
      CategoryPublicOutputDto,
      categoryObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<CategoryPublicOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicCategory,
      message: 'Category restored successfully',
    });
  }
}
