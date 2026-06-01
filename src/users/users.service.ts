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
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
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

    // Future roles (e.g. restaurant manager) can be handled here.

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

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    const code = googleLoginDto.code;
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
}

// const oauthGoogle = async (req: Request, res: Response) => {
//   let { code } = req.body;
//   let googleUser;

//   try {
//     googleUser = await getUserFromGoogle(code);

//     if (!googleUser || !googleUser.email || !googleUser.name) {
//       OrchestrationResult.serverError(
//         res,
//         CODES.GOOGLE_AUTH_ERROR,
//         "Failed to authenticate with Google"
//       );
//       return;
//     }
//   } catch (error) {
//     console.error(error);
//     OrchestrationResult.serverError(
//       res,
//       CODES.GOOGLE_AUTH_ERROR,
//       "Failed to authenticate with Google"
//     );
//     return;
//   }

//   const existingUser = await prisma.user.findUnique({
//     where: {
//       email: googleUser.email,
//     },
//   });

//   let user;

//   if (existingUser) {
//     if (existingUser.type !== "Client") {
//       OrchestrationResult.badRequest(
//         res,
//         CODES.CLIENT_ONLY,
//         "Admins are not allowed to use this route"
//       );
//       return;
//     }

//     if (!existingUser?.isActive) {
//       OrchestrationResult.badRequest(
//         res,
//         CODES.ACCOUNT_NOT_ACTIVATED,
//         "Activate your account"
//       );
//       return;
//     }

//     if (existingUser?.isDeleted) {
//       OrchestrationResult.badRequest(
//         res,
//         CODES.ACCOUNT_DELETED,
//         "Your account has been deleted, contact support."
//       );
//       return;
//     }

//     user = existingUser;
//   } else {
//     user = await prisma.user.create({
//       data: {
//         email: googleUser.email,
//         name: googleUser.name,
//         type: UserType.Client,
//         isActive: true,
//       },
//     });
//   }

//   const { accessToken, refreshToken } = generateTokens({
//     id: user.id,
//     email: user.email,
//     type: user.type,
//   });

//   await prisma.user.update({
//     where: {
//       id: user.id,
//     },
//     data: {
//       token: refreshToken,
//     },
//   });

//   const data: UserReturned = {
//     id: user.id,
//     name: user.name || "",
//     email: user.email,
//     type: user.type,
//     createdAt: user.createdAt,
//     updatedAt: user.updatedAt,
//     accessToken,
//     refreshToken,
//   };

//   OrchestrationResult.item(res, data, 200);
// };
