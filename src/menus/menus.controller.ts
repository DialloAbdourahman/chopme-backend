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
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/input/create-menu.dto';
import { UpdateMenuDto } from './dto/input/update-menu.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import {
  RestaurantRoleGuard,
  RestaurantRoles,
} from 'src/common/guards/restaurant-role.guard';
import { EnumRestaurantMemberRole } from 'src/common/enums/restaurant-member-role';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { env } from 'src/config/env';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EnumStatusCode } from 'src/common/enums/response-status-code';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe()) createMenuDto: CreateMenuDto,
  ) {
    return this.menusService.create(createMenuDto, user);
  }

  @Get('search')
  search(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('restaurantId') restaurantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.menusService.search({
      search,
      page,
      limit,
      restaurantId,
      categoryId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menusService.findOne(id);
  }

  @Patch(':id/toggle-available')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  toggleAvailable(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.menusService.toggleAvailable(id, user);
  }

  @Patch(':id/restore')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  restore(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.menusService.restore(id, user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  update(
    @Param('id') id: string,
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe()) updateMenuDto: UpdateMenuDto,
  ) {
    return this.menusService.update(id, updateMenuDto, user);
  }

  @Post(':id/upload-image')
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
    return this.menusService.uploadMenuImage(id, file, user);
  }

  @Post(':id/upload-cover-image')
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
    return this.menusService.uploadMenuCoverImage(id, file, user);
  }

  @Delete(':id/images')
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
    return this.menusService.deleteMenuImage(id, key, user);
  }

  @Delete(':id/cover-image')
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
    return this.menusService.deleteMenuCoverImage(id, user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard, RestaurantRoleGuard)
  @Roles(EnumUserRole.RESTAURANT_MEMBER)
  @RestaurantRoles(
    EnumRestaurantMemberRole.OWNER,
    EnumRestaurantMemberRole.MANAGER,
  )
  remove(@Param('id') id: string, @CurrentUser() user: ILoggedInUserTokenData) {
    return this.menusService.remove(id, user);
  }
}
