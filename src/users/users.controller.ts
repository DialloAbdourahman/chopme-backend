import { Body, Controller, Get, Post, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailPasswordLoginDto } from './dtos/input/email-password-login.dto';
import { GoogleLoginDto } from './dtos/input/google-login.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('email-password-login')
  emailPasswordLogin(
    @Body(new ValidationPipe())
    user: EmailPasswordLoginDto,
  ) {
    return this.usersService.emailPasswordLogin(user);
  }

  @Post('google-login')
  googleLogin(
    @Body(new ValidationPipe())
    user: GoogleLoginDto,
  ) {
    return this.usersService.googleLogin(user);
  }

  @Post('token')
  refreshToken() {
    return this.usersService.refreshToken('token');
  }

  @Post('logout')
  logout() {
    return this.usersService.logout('token');
  }

  @Get('me')
  me() {
    return this.usersService.getMyProfile('token');
  }
}
