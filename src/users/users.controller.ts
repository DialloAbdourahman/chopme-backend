import { Body, Controller, Get, Post, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('email-password-login')
  emailPasswordLogin(
    @Body(new ValidationPipe())
    emailPasswordLoginDto: EmailPasswordLoginDto,
  ) {
    return this.usersService.emailPasswordLogin(emailPasswordLoginDto);
  }

  @Post('google-login')
  googleLogin(
    @Body(new ValidationPipe())
    googleLoginDto: GoogleLoginDto,
  ) {
    return this.usersService.googleLogin(googleLoginDto);
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
