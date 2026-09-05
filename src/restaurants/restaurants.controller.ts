import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  DefaultValuePipe,
  ParseIntPipe,
  ParseFloatPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/input/create-restaurant.dto';
import {
  UpdateRestaurantDto,
  AdminUpdateRestaurantDto,
} from './dto/input/update-restaurant.dto';
import { AddRestaurantWalletDto } from './dto/input/restaurant-wallet.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import {
  RestaurantRoleGuard,
  RestaurantRoles,
} from 'src/common/guards/restaurant-role.guard';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { env } from 'src/config/env';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { FindRestaurantDto } from './dto/input/find-restaurant.dto';
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createRestaurantDto: CreateRestaurantDto,
  ) {
    return this.restaurantsService.create(createRestaurantDto, user);
  }

  @Get('check-name')
  @HttpCode(HttpStatus.OK)
  checkName(@Query('name') name: string) {
    return this.restaurantsService.checkName(name);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  findAll(
    @Body() filters: FindRestaurantDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.restaurantsService.findAll(filters, page, limit);
  }

  @Get('admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  findAllForAdmin(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('type') type?: EnumRestaurantType,
    @Query('deleted', new DefaultValuePipe(false), ParseBoolPipe)
    deleted?: boolean,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.restaurantsService.findAllForAdmin({
      search,
      type,
      page,
      limit,
      deleted,
      sortBy,
      sortOrder,
    });
  }

  @Get('admin/:idOrSlug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  findOneForAdmin(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.findOnePrivate({
      idOrSlug,
      user,
      considerDelete: true,
    });
  }

  @Get('member/:idOrSlug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  findOnePrivate(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.findOnePrivate({
      idOrSlug,
      user,
    });
  }

  @Get(':idOrSlug')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Query('longitude', new ParseFloatPipe({ optional: true }))
    longitude?: number,
    @Query('latitude', new ParseFloatPipe({ optional: true }))
    latitude?: number,
  ) {
    return this.restaurantsService.findOne(idOrSlug, longitude, latitude);
  }

  @Patch(':id/increment-views')
  @HttpCode(HttpStatus.OK)
  incrementTotalViews(@Param('id') id: string) {
    return this.restaurantsService.incrementTotalViews(id);
  }

  @Patch(':id/toggle-closed')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  toggleClosed(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.toggleClosed(id, user);
  }

  @Patch('admin/:id/toggle-closed')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  adminToggleClosed(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.toggleClosed(id, user);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  restore(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.restore(id, user);
  }

  @Patch(':id/admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  adminUpdate(
    @Param('id') id: string,
    @Body()
    adminUpdateRestaurantDto: AdminUpdateRestaurantDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.adminUpdate(
      id,
      adminUpdateRestaurantDto,
      user,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  update(
    @Param('id') id: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.update(id, updateRestaurantDto, user);
  }

  @Post(':id/upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new OrchestrationException({
              statusCode: EnumStatusCode.ONLY_IMAGE_FILES_ALLOWED,
              message: 'Only image files are allowed',
              code: 400,
            }),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: env.maxRestaurantImageSizeInMb * 1024 * 1024,
      },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.uploadRestaurantImage(id, file, user);
  }

  @Post(':id/upload-cover-image')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new OrchestrationException({
              statusCode: EnumStatusCode.ONLY_IMAGE_FILES_ALLOWED,
              message: 'Only image files are allowed',
              code: 400,
            }),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: env.maxRestaurantImageSizeInMb * 1024 * 1024,
      },
    }),
  )
  uploadCoverImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.uploadRestaurantCoverImage(id, file, user);
  }

  @Delete(':id/images')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  deleteImage(
    @Param('id') id: string,
    @Query('key') key: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.deleteRestaurantImage(id, key, user);
  }

  @Delete(':id/cover-image')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  deleteCoverImage(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.deleteRestaurantCoverImage(id, user);
  }

  @Post('admin/:id/upload-image')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new OrchestrationException({
              statusCode: EnumStatusCode.ONLY_IMAGE_FILES_ALLOWED,
              message: 'Only image files are allowed',
              code: 400,
            }),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: env.maxRestaurantImageSizeInMb * 1024 * 1024,
      },
    }),
  )
  adminUploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.uploadRestaurantImage(id, file, user);
  }

  @Post('admin/:id/upload-cover-image')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new OrchestrationException({
              statusCode: EnumStatusCode.ONLY_IMAGE_FILES_ALLOWED,
              message: 'Only image files are allowed',
              code: 400,
            }),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: env.maxRestaurantImageSizeInMb * 1024 * 1024,
      },
    }),
  )
  adminUploadCoverImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.uploadRestaurantCoverImage(id, file, user);
  }

  @Delete('admin/:id/images')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  adminDeleteImage(
    @Param('id') id: string,
    @Query('key') key: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.deleteRestaurantImage(id, key, user);
  }

  @Delete('admin/:id/cover-image')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  adminDeleteCoverImage(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.deleteRestaurantCoverImage(id, user);
  }

  @Get(':id/wallet')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.OWNER)
  getWallet(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.getWallet(id, user);
  }

  @Post(':id/wallet')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.OWNER)
  addWallet(
    @Param('id') id: string,
    @Body() addRestaurantWalletDto: AddRestaurantWalletDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.addWallet(id, addRestaurantWalletDto, user);
  }

  @Delete(':id/wallet')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.OWNER)
  removeWallet(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.removeWallet(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantsService.remove(id, user);
  }
}
