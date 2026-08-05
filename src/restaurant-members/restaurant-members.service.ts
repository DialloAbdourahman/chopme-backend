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
import { RestaurantMemberOutputDto } from './dto/output/restaurant-member-output.dto';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumAuthType } from 'src/common/enums/auth-types';
import * as bcrypt from 'bcrypt';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { Pagination } from 'src/common/interfaces/pagination';

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

    if (createRestaurantMemberDto.role === EnumRestaurantMemberRole.OWNER) {
      this.logger.log(
        `[create] Cannot create owner role for user id=${managerUser.id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CANNOT_CREATE_OWNER,
        message: 'Cannot create owner role',
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

      await member.populate('restaurant');
      await member.populate('user');
      const memberObject = member.toObject();

      const publicMember = plainToInstance(
        RestaurantMemberOutputDto,
        memberObject,
        {
          excludeExtraneousValues: true,
        },
      );

      return OrchestrationResult.Success<RestaurantMemberOutputDto>({
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

  async search(
    {
      search,
      page,
      limit,
      role,
      deleted,
    }: {
      search?: string;
      page: number;
      limit: number;
      role?: EnumRestaurantMemberRole;
      deleted?: boolean;
    },
    managerUser?: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[search] Searching restaurant members with filters: search=${search}, page=${page}, limit=${limit}, deleted=${deleted}, restaurantId=${managerUser?.restaurantId}`,
    );

    const pipeline: any[] = [];

    // Initial restaurant and deleted filters
    pipeline.push({
      $match: {
        restaurant: new Types.ObjectId(managerUser!.restaurantId!),
        deleted: deleted ?? false,
      },
    });

    // Join with users collection to enable search on user fields
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user',
      },
    });

    pipeline.push({
      $unwind: '$user',
    });

    // Apply search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.fullName': { $regex: search, $options: 'i' } },
            { 'user.email': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // Apply role filter
    if (role) {
      pipeline.push({
        $match: {
          role: role,
        },
      });
    }

    this.logger.log(
      `[search] Searching restaurant members with pipeline`,
      pipeline,
    );

    // Get total count
    const countPipeline = [...pipeline, { $count: 'count' }];
    const [countResult] =
      await this.restaurantMemberModel.aggregate(countPipeline);
    const totalItems = countResult?.count || 0;

    // Get paginated items
    const itemsPipeline = [
      ...pipeline,
      {
        $lookup: {
          from: 'restaurants',
          localField: 'restaurant',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: '$restaurant' },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    const members = await this.restaurantMemberModel.aggregate(itemsPipeline);

    const totalPages = Math.ceil(totalItems / limit);

    const publicMembers = plainToInstance(RestaurantMemberOutputDto, members, {
      excludeExtraneousValues: true,
    });

    const paginatedResult: Pagination<RestaurantMemberOutputDto> = {
      items: publicMembers,
      page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    };

    return OrchestrationResult.Success<Pagination<RestaurantMemberOutputDto>>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: paginatedResult,
      message: 'Restaurant members retrieved successfully',
    });
  }

  async findOne(user: ILoggedInUserTokenData) {
    this.logger.log(
      `[findOne] Getting restaurant member profile for user id=${user.id}, restaurantMemberId=${user.restaurantMemberId}`,
    );

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
      RestaurantMemberOutputDto,
      memberObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantMemberOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicMember,
      message: 'Restaurant member retrieved successfully',
    });
  }

  async restore(memberId: string, managerUser: ILoggedInUserTokenData) {
    this.logger.log(
      `[restore] Restoring restaurant member id=${memberId} by manager user id=${managerUser.id}, restaurantId=${managerUser.restaurantId}`,
    );

    const restaurantObjectId = new Types.ObjectId(managerUser.restaurantId);

    const member = await this.restaurantMemberModel.findOne({
      _id: new Types.ObjectId(memberId),
      restaurant: restaurantObjectId,
      deleted: true,
    });

    if (!member) {
      this.logger.log(
        `[restore] Restaurant member not found id=${memberId} in restaurantId=${managerUser.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant member not found',
        code: 404,
      });
    }

    const user = await this.userModel.findOne({
      _id: member.user.toString(),
      deleted: true,
    });

    if (!user) {
      this.logger.error(
        `[restore] No user found for restaurant member id=${memberId}, userId=${member.user}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.LINKED_USER_NOT_FOUND,
        message: 'User linked to restaurant member not found',
        code: 500,
      });
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      member.deleted = false;
      member.deletedAt = null;
      member.deletedBy = null;
      await member.save({ session });

      user.deleted = false;
      user.active = true;
      user.deletedAt = null;
      user.deletedBy = null;
      await user.save({ session });

      await session.commitTransaction();
      this.logger.log(
        `[restore] Restaurant member id=${memberId} restored successfully`,
      );

      await member.populate('restaurant');
      await member.populate('user');
      const memberObject = member.toObject();

      const publicMember = plainToInstance(
        RestaurantMemberOutputDto,
        memberObject,
        {
          excludeExtraneousValues: true,
        },
      );

      return OrchestrationResult.Success<RestaurantMemberOutputDto>({
        statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
        data: publicMember,
        message: 'Restaurant member restored successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[restore] Error during restaurant member restore: ${error?.message}`,
        error?.stack,
      );

      if (error instanceof OrchestrationException) {
        throw error;
      }

      throw new OrchestrationException({
        statusCode: EnumStatusCode.LINKED_USER_NOT_FOUND,
        message: 'Unable to restore restaurant member',
        code: 500,
      });
    } finally {
      session.endSession();
    }
  }

  async updateRole(
    memberId: string,
    role: EnumRestaurantMemberRole,
    managerUser: ILoggedInUserTokenData,
  ) {
    this.logger.log(
      `[updateRole] Updating role of restaurant member id=${memberId} to role=${role} by manager user id=${managerUser.id}, restaurantId=${managerUser.restaurantId}`,
    );

    if (role === EnumRestaurantMemberRole.OWNER) {
      this.logger.log(
        `[updateRole] Attempt to update role of owner restaurant member id=${memberId} in restaurantId=${managerUser.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CANNOT_CREATE_OWNER,
        message: 'Cannot update role to owner',
      });
    }

    const restaurantObjectId = new Types.ObjectId(managerUser.restaurantId);

    const member = await this.restaurantMemberModel.findOne({
      _id: new Types.ObjectId(memberId),
      restaurant: restaurantObjectId,
      deleted: false,
    });

    if (!member) {
      this.logger.log(
        `[updateRole] Restaurant member not found id=${memberId} in restaurantId=${managerUser.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant member not found',
        code: 404,
      });
    }

    member.role = role;
    await member.save();

    await member.populate('restaurant');
    await member.populate('user');
    const memberObject = member.toObject();

    const publicMember = plainToInstance(
      RestaurantMemberOutputDto,
      memberObject,
      {
        excludeExtraneousValues: true,
      },
    );

    return OrchestrationResult.Success<RestaurantMemberOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicMember,
      message: 'Restaurant member role updated successfully',
    });
  }

  async remove(memberId: string, managerUser: ILoggedInUserTokenData) {
    this.logger.log(
      `[remove] Soft deleting restaurant member id=${memberId} by manager user id=${managerUser.id}, restaurantId=${managerUser.restaurantId}`,
    );

    if (memberId === managerUser.restaurantMemberId) {
      this.logger.log(
        `[remove] Attempt to delete self restaurant member id=${memberId} in restaurantId=${managerUser.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CANNOT_DELETE_SELF,
        message: 'Cannot delete yourself',
        code: 400,
      });
    }

    const restaurantObjectId = new Types.ObjectId(managerUser.restaurantId);

    const member = await this.restaurantMemberModel.findOne({
      _id: new Types.ObjectId(memberId),
      restaurant: restaurantObjectId,
      deleted: false,
    });

    if (!member) {
      this.logger.log(
        `[remove] Restaurant member not found id=${memberId} in restaurantId=${managerUser.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Restaurant member not found',
        code: 404,
      });
    }

    if (member.role === EnumRestaurantMemberRole.OWNER) {
      this.logger.log(
        `[remove] Attempt to delete owner restaurant member id=${memberId} in restaurantId=${managerUser.restaurantId}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.CANNOT_DELETE_OWNER,
        message: 'Cannot delete restaurant owner',
        code: 403,
      });
    }

    const user = await this.userModel.findOne({
      _id: member.user.toString(),
      deleted: false,
    });

    if (!user) {
      this.logger.error(
        `[remove] No user found for restaurant member id=${memberId}, userId=${member.user}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
        message: 'User linked to restaurant member not found',
        code: 500,
      });
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const deletedAt = new Date();
      const deletedById = new Types.ObjectId(managerUser.id);

      member.deleted = true;
      member.deletedAt = deletedAt;
      member.deletedBy = deletedById;
      await member.save({ session });

      user.deleted = true;
      user.active = false;
      user.deletedAt = deletedAt;
      user.deletedBy = deletedById;
      user.tokens = [];
      await user.save({ session });

      await session.commitTransaction();
      this.logger.log(
        `[remove] Restaurant member id=${memberId} soft deleted successfully`,
      );

      return OrchestrationResult.Success<string>({
        statusCode: EnumStatusCode.DELETED_SUCCESSFULLY,
        data: 'Restaurant member deleted successfully',
        message: 'Restaurant member deleted successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[remove] Error during restaurant member deletion: ${error?.message}`,
        error?.stack,
      );

      if (error instanceof OrchestrationException) {
        throw error;
      }

      throw new OrchestrationException({
        statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
        message: 'Unable to delete restaurant member',
        code: 500,
      });
    } finally {
      session.endSession();
    }
  }
}
