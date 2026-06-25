import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  ValidationPipe,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';
import { UpdateUserDto } from './dto/input/update-user.dto';
import { UpdatePasswordDto } from './dto/input/update-password.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('email-password-login')
  emailPasswordLogin(
    @Body()
    emailPasswordLoginDto: EmailPasswordLoginDto,
  ) {
    return this.usersService.emailPasswordLogin(emailPasswordLoginDto);
  }

  @Post('google-login')
  googleLogin(
    @Body()
    googleLoginDto: GoogleLoginDto,
  ) {
    return this.usersService.googleLogin(googleLoginDto);
  }

  @Post('token')
  refreshToken(@Headers('authorization') authorization: string) {
    const token = authorization?.split(' ')[1] || '';
    return this.usersService.refreshToken(token);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.usersService.logout(user);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.usersService.getMyProfile(user);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  updateMe(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateMyProfile(user, updateUserDto);
  }

  @Patch('me/password')
  @UseGuards(AuthGuard)
  updatePassword(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user, updatePasswordDto);
  }
}
