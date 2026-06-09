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
import { MenuPublicOutputDto } from './dto/output/menu-outpus.dto';

@Injectable()
export class MenusService {
  private readonly logger = new Logger(MenusService.name);

  constructor(
    @InjectModel(Menu.name)
    private readonly menuModel: Model<MenuDocument>,
  ) {}

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

    const restaurantObjectId = new Types.ObjectId(user.restaurantId);

    const menu = await this.menuModel.create({
      restaurant: restaurantObjectId,
      name: createMenuDto.name,
      category: createMenuDto.category,
      description: createMenuDto.description,
      price: createMenuDto.price,
      available:
        typeof createMenuDto.available === 'boolean'
          ? createMenuDto.available
          : true,
    });
    await menu.populate('restaurant');

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPublicOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPublicOutputDto>({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu created successfully',
    });
  }

  findAll() {
    return `This action returns all menus`;
  }

  findOne(id: number) {
    return `This action returns a #${id} menu`;
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
      menu.category = updateMenuDto.category;
    }

    if (updateMenuDto.description !== undefined) {
      menu.description = updateMenuDto.description;
    }

    if (updateMenuDto.price !== undefined) {
      menu.price = updateMenuDto.price;
    }

    await menu.save();
    await menu.populate('restaurant');

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPublicOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPublicOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu updated successfully',
    });
  }

  remove(id: number) {
    return `This action removes a #${id} menu`;
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
    await menu.populate('restaurant');

    const menuObject = menu.toObject();

    const publicMenu = plainToInstance(MenuPublicOutputDto, menuObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<MenuPublicOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicMenu,
      message: 'Menu availability updated successfully',
    });
  }
}
