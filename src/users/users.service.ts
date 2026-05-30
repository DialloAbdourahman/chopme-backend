import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { Client, ClientDocument } from 'src/clients/entities/client.entity';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';
import { EnumAuthType } from 'src/common/enums/auth-types';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { env } from 'src/config/env';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';
import { LoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    private jwtService: JwtService,
  ) {}

  private async buildTokenPayload(
    user: UserDocument,
  ): Promise<LoggedInUserTokenData> {
    const payload: LoggedInUserTokenData = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    if (user.role === EnumUserRole.CLIENT) {
      this.logger.log(
        `[buildTokenPayload] Fetching client for user id=${user._id}`,
      );
      const client = await this.clientModel.findOne({ user: user._id });
      if (!client) {
        this.logger.error(
          `[buildTokenPayload] No client linked to user id=${user._id}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INVALID_CREDENTIALS,
          message: 'Invalid credentials',
          code: 401,
        });
      }
      payload.clientId = client._id.toString();
    }

    // Future roles (e.g. restaurant manager) can be handled here.

    return payload;
  }

  async emailPasswordLogin(emailPasswordLoginDto: EmailPasswordLoginDto) {
    this.logger.log('[emailPasswordLogin] Starting email/password login flow');

    const normalizedEmail = emailPasswordLoginDto.email.toLowerCase().trim();
    this.logger.log(
      `[emailPasswordLogin] Fetching user with email=${normalizedEmail}`,
    );

    const user = await this.userModel.findOne({ email: normalizedEmail });

    if (!user) {
      this.logger.log(
        `[emailPasswordLogin] Invalid credentials for email=${normalizedEmail}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: 401,
      });
    }

    if (user.authType !== EnumAuthType.EMAIL_PASSWORD) {
      this.logger.log(
        `[emailPasswordLogin] Invalid login method for email=${normalizedEmail}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: 401,
      });
    }

    const isPasswordValid = await bcrypt.compare(
      emailPasswordLoginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      this.logger.log(
        `[emailPasswordLogin] Invalid credentials for email=${normalizedEmail}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: 401,
      });
    }

    this.logger.log('[emailPasswordLogin] Generating tokens...');

    const tokenPayload = await this.buildTokenPayload(user);

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: env.accessTokenSecret,
      expiresIn: `${env.accessTokenDurationMins}m`,
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: env.refreshTokenSecret,
      expiresIn: `${env.refreshTokenDurationMins}m`,
    });

    user.token = refreshToken;
    await user.save();

    const publicUser = plainToInstance(UserPublicOutputDto, user, {
      excludeExtraneousValues: true,
    });

    this.logger.log('[emailPasswordLogin] Tokens generated successfully');

    return OrchestrationResult.Success<{
      accessToken: string;
      refreshToken: string;
      user: UserPublicOutputDto;
    }>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: {
        accessToken,
        refreshToken,
        user: publicUser,
      },
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
    this.logger.log('[refreshToken] Refreshing token');

    if (!token) {
      this.logger.log('[refreshToken] No token provided');
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: 401,
      });
    }

    let decoded: LoggedInUserTokenData;
    try {
      decoded = this.jwtService.verify(token, {
        secret: env.refreshTokenSecret,
      });
    } catch (error) {
      this.logger.log(
        `[refreshToken] Invalid or expired refresh token: ${error?.message}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: 401,
      });
    }

    const user = await this.userModel.findById(decoded.id);

    if (!user || user.token !== token) {
      this.logger.log(
        `[refreshToken] Stored refresh token mismatch for user id=${decoded.id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        code: 401,
      });
    }

    const tokenPayload = await this.buildTokenPayload(user);

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: env.accessTokenSecret,
      expiresIn: `${env.accessTokenDurationMins}m`,
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: env.refreshTokenSecret,
      expiresIn: `${env.refreshTokenDurationMins}m`,
    });

    user.token = refreshToken;
    await user.save();

    const publicUser = plainToInstance(UserPublicOutputDto, user, {
      excludeExtraneousValues: true,
    });

    this.logger.log('[refreshToken] Tokens refreshed successfully');

    return OrchestrationResult.Success<{
      accessToken: string;
      refreshToken: string;
      user: UserPublicOutputDto;
    }>({
      statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
      data: {
        accessToken,
        refreshToken,
        user: publicUser,
      },
      message: 'Token refreshed successfully',
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
