import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';
import { UpdateUserDto } from './dto/input/update-user.dto';
import { UpdatePasswordDto } from './dto/input/update-password.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { CreateClientDto } from 'src/users/dto/input/create-client.dto';

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

  @Post('token')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Headers('authorization') authorization: string) {
    const token = authorization?.split(' ')[1] || '';
    return this.usersService.refreshToken(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.usersService.logout(user);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.usersService.getMyProfile(user);
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
