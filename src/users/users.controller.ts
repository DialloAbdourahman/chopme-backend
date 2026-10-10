import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Headers,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { LogoutDto } from './dto/input/logout.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';
import { UpdateUserDto } from './dto/input/update-user.dto';
import { UpdatePasswordDto } from './dto/input/update-password.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { EnumUserRole } from 'src/common/enums/user-roles';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { CreateClientDto } from 'src/users/dto/input/create-client.dto';
import { AdminUsersQueryDto } from 'src/users/dto/input/admin-users-query.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createClientDto: CreateClientDto) {
    return this.usersService.create(createClientDto);
  }

  @Post('email-password-login')
  @HttpCode(HttpStatus.OK)
  emailPasswordLogin(
    @Body()
    emailPasswordLoginDto: EmailPasswordLoginDto,
  ) {
    return this.usersService.emailPasswordLogin(emailPasswordLoginDto);
  }

  @Post('google-login')
  @HttpCode(HttpStatus.OK)
  googleLogin(
    @Body()
    googleLoginDto: GoogleLoginDto,
  ) {
    return this.usersService.googleLogin(googleLoginDto);
  }

  @Get('token')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Headers('authorization') authorization: string) {
    const token = authorization?.split(' ')[1] || '';
    return this.usersService.refreshToken(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  logout(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() logoutDto: LogoutDto,
  ) {
    return this.usersService.logout(user, logoutDto.token);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.usersService.getMyProfile(user);
  }

  @Post('admin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  getAdminUsers(
    @Body() query: AdminUsersQueryDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.usersService.getAdminUsers({ query, page, limit });
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  updateMe(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateMyProfile(user, updateUserDto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  updatePassword(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user, updatePasswordDto);
  }
}
