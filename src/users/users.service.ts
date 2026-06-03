import { Injectable, Logger } from '@nestjs/common';

import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { Client, ClientDocument } from 'src/clients/entities/client.entity';
import {
  RestaurantMember,
  RestaurantMemberDocument,
} from 'src/restaurants/entities/restaurant-member.entity';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import { EmailPasswordLoginDto } from './dto/input/email-password-login.dto';
import { GoogleLoginDto } from './dto/input/google-login.dto';
import { EnumAuthType } from 'src/common/enums/auth-types';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { env } from 'src/config/env';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { JwtService } from '@nestjs/jwt';
import { getUserFromGoogle } from 'src/common/utils/get-user-from-google';
import type { IUserFromGoogle } from 'src/common/interfaces/user-from-google';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly jwtService: JwtService,
  ) {}

  private async buildTokenPayload(
    user: UserDocument,
  ): Promise<ILoggedInUserTokenData> {
    const payload: ILoggedInUserTokenData = {
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

    if (user.role === EnumUserRole.RESTAURANT_MEMBER) {
      this.logger.log(
        `[buildTokenPayload] Fetching restaurant member for user id=${user._id}`,
      );

      const restaurantMember = await this.restaurantMemberModel.findOne({
        user: user._id,
      });

      if (!restaurantMember) {
        this.logger.error(
          `[buildTokenPayload] No restaurant member linked to user id=${user._id}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INVALID_CREDENTIALS,
          message: 'Invalid credentials',
          code: 401,
        });
      }

      payload.restaurantMemberId = restaurantMember._id.toString();
      payload.restaurantId = restaurantMember.restaurant.toString();
      payload.restaurantMemberRole = restaurantMember.role;
    }

    return payload;
  }

  async emailPasswordLogin(emailPasswordLoginDto: EmailPasswordLoginDto) {
    this.logger.log('[emailPasswordLogin] Starting email/password login flow');

    const normalizedEmail = emailPasswordLoginDto.email.toLowerCase().trim();
    this.logger.log(
      `[emailPasswordLogin] Fetching user with email=${normalizedEmail}`,
    );

    const user = await this.userModel.findOne({
      email: normalizedEmail,
      deleted: false,
      active: true,
    });

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
        statusCode: EnumStatusCode.LOGIN_METHOD_NOT_ALLOWED,
        message: 'Login method not allowed',
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

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    this.logger.log('[googleLogin] Starting Google login flow');

    const code = googleLoginDto.code;
    let googleUser: IUserFromGoogle | null = null;

    try {
      this.logger.log('[googleLogin] Exchanging code for Google user');
      googleUser = await getUserFromGoogle({
        code,
        googleClientId: env.googleClientId,
        googleClientSecret: env.googleClientSecret,
        googleRedirectLink: env.googleRedirectLink,
      });

      if (!googleUser || !googleUser.email || !googleUser.name) {
        this.logger.error('[googleLogin] Failed to retrieve Google user');
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to authenticate with Google',
          code: 500,
        });
      }
    } catch (error) {
      this.logger.error(
        `[googleLogin] Error authenticating with Google: ${error?.message}`,
        error?.stack,
      );
      if (error instanceof OrchestrationException) {
        throw error;
      }
      throw new OrchestrationException({
        statusCode: EnumStatusCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to authenticate with Google',
        code: 500,
      });
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();

    this.logger.log(
      `[googleLogin] Looking up user with email=${normalizedEmail}`,
    );

    let user = await this.userModel.findOne({ email: normalizedEmail });

    if (user) {
      this.logger.log(`[googleLogin] Found existing user id=${user._id}`);

      if (user.role !== EnumUserRole.CLIENT) {
        this.logger.log(
          `[googleLogin] Unsupported role=${user.role} for email=${normalizedEmail}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.LOGIN_METHOD_NOT_ALLOWED,
          message: 'Only clients can login with Google',
          code: 401,
        });
      }

      if (!user.active || user.deleted) {
        this.logger.log(
          `[googleLogin] Inactive or deleted user for email=${normalizedEmail}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INVALID_CREDENTIALS,
          message: 'Invalid credentials',
          code: 401,
        });
      }

      if (user.authType !== EnumAuthType.GOOGLE) {
        this.logger.log(
          `[googleLogin] Invalid login method for email=${normalizedEmail}`,
        );
        throw new OrchestrationException({
          statusCode: EnumStatusCode.INVALID_CREDENTIALS,
          message: 'Invalid credentials',
          code: 401,
        });
      }
    } else {
      this.logger.log(
        `[googleLogin] No existing user for email=${normalizedEmail}, creating new CLIENT user`,
      );

      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        user = new this.userModel({
          fullName: googleUser.name,
          email: normalizedEmail,
          password: '',
          role: EnumUserRole.CLIENT,
          authType: EnumAuthType.GOOGLE,
          active: true,
        });
        await user.save({ session });
        this.logger.log(`[googleLogin] Created user id=${user._id}`);

        const client = new this.clientModel({
          user: user._id,
        });
        await client.save({ session });

        this.logger.log(
          `[googleLogin] Created client id=${client._id} for user id=${user._id}`,
        );

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        this.logger.error(
          `[googleLogin] Error during client signup: ${error?.message}`,
          error?.stack,
        );

        throw new OrchestrationException({
          statusCode: EnumStatusCode.UNABLE_TO_CREATE_ACCOUNT,
          message: 'Unable to create client account',
          code: 500,
        });
      } finally {
        session.endSession();
      }
    }

    this.logger.log('[googleLogin] Generating tokens...');

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

    this.logger.log('[googleLogin] Google login successful');

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

  async refreshToken(token: string) {
    this.logger.log('[refreshToken] Refreshing token');

    if (!token) {
      this.logger.log('[refreshToken] No token provided');
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NO_TOKEN_PROVIDED,
        message: 'No token provided',
        code: 401,
      });
    }

    let decoded: ILoggedInUserTokenData;
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

    const user = await this.userModel.findOne({
      _id: decoded.id,
      deleted: false,
      active: true,
    });

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

  async logout(user: ILoggedInUserTokenData) {
    this.logger.log(`[logout] Logging out user id=${user.id}`);

    const dbUser = await this.userModel.findOne({
      _id: user.id,
      deleted: false,
      active: true,
    });

    if (!dbUser) {
      this.logger.log(`[logout] User not found or inactive for id=${user.id}`);
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'User not found',
        code: 404,
      });
    }

    dbUser.token = '';
    await dbUser.save();

    return OrchestrationResult.Success<string>({
      statusCode: EnumStatusCode.LOGGED_OUT_SUCCESSFULLY,
      data: 'Logged out',
      message: 'User logged out successfully',
    });
  }

  async getMyProfile(user: ILoggedInUserTokenData) {
    this.logger.log(`[getMyProfile] Fetching profile for user id=${user.id}`);

    const dbUser = await this.userModel.findOne({
      _id: user.id,
      deleted: false,
      active: true,
    });

    if (!dbUser) {
      this.logger.log(
        `[getMyProfile] User not found or inactive for id=${user.id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'User not found',
        code: 404,
      });
    }

    const publicUser = plainToInstance(UserPublicOutputDto, dbUser, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<UserPublicOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicUser,
      message: 'Profile fetched successfully',
    });
  }

  async updateMyProfile(
    user: ILoggedInUserTokenData,
    updateUserDto: { fullName?: string },
  ) {
    this.logger.log(
      `[updateMyProfile] Updating profile for user id=${user.id}`,
    );

    const dbUser = await this.userModel.findOne({
      _id: user.id,
      deleted: false,
      active: true,
    });

    if (!dbUser) {
      this.logger.log(
        `[updateMyProfile] User not found or inactive for id=${user.id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'User not found',
        code: 404,
      });
    }

    dbUser.fullName = updateUserDto.fullName || dbUser.fullName;
    await dbUser.save();

    const publicUser = plainToInstance(UserPublicOutputDto, dbUser, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<UserPublicOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicUser,
      message: 'Profile updated successfully',
    });
  }
}
