import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async emailPasswordLogin(user: EmailPasswordLoginDto) {
    throw new OrchestrationException({
      statusCode: EnumStatusCode.NOT_FOUND,
      message: 'Not found',
    });

    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: 'Token',
      message: 'User logged in successfully',
    });
  }

  async googleLogin(user: GoogleLoginDto) {
    this.logger.log(`[googleLogin] Fetching user email=`);

    this.logger.log(`[findOne] Found user `);
    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: 'Token',
      message: 'User logged in successfully',
    });
  }

  async refreshToken(token: string) {
    this.logger.log(`[refreshToken] Refreshing token=${token}`);
    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: 'Token',
      message: 'User logged in successfully',
    });
  }

  async logout(token: string) {
    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: 'Token',
      message: 'User logged in successfully',
    });
  }

  async getMyProfile(token: string) {
    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: 'Token',
      message: 'User logged in successfully',
    });
  }
}
