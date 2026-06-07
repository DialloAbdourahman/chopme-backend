import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/input/create-restaurant.dto';
import {
  UpdateRestaurantDto,
  AdminUpdateRestaurantDto,
} from './dto/input/update-restaurant.dto';
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
import { EnumRestaurantType } from 'src/common/enums/restaurant-types';
import { FindRestaurantDto } from './dto/input/find-restaurant.dto';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe()) createRestaurantDto: CreateRestaurantDto,
  ) {
    return this.restaurantsService.create(createRestaurantDto, user);
  }

  @Get('check-name')
  checkName(@Query('name') name: string) {
    return this.restaurantsService.checkName(name);
  }

  @Post('search')
  findAll(@Body(new ValidationPipe()) filters: FindRestaurantDto) {
    return this.restaurantsService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurantsService.findOne(id);
  }

  @Patch(':id/toggle-closed')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  toggleClosed(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.toggleClosed(id, user);
  }

  @Patch(':id/restore')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  restore(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.restore(id, user);
  }

  @Patch(':id/admin')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  adminUpdate(
    @Param('id') id: string,
    @Body(new ValidationPipe())
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
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.update(id, updateRestaurantDto, user);
  }

  @Post(':id/upload-image')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
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

  @Delete(':id/images')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(EnumRestaurantMemberRole.MANAGER)
  deleteImage(
    @Param('id') id: string,
    @Query('key') key: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.restaurantsService.deleteRestaurantImage(id, key, user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: ILoggedInUserTokenData) {
    return this.restaurantsService.remove(id, user);
  }
}
