import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { CreateClientDto } from './dto/input/create-client.dto';
import { Client, ClientDocument } from './entities/client.entity';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { EnumAuthType } from 'src/common/enums/auth-types';
import { InjectConnection } from '@nestjs/mongoose';
import { OrchestrationResult } from 'src/common/utils/orchestration.result';
import { EnumStatusCode } from 'src/common/enums/response-status-code';
import { OrchestrationException } from 'src/common/exceptions/orchestration.exception';
import * as bcrypt from 'bcrypt';
import { JWTUtils } from 'src/common/utils/jwt-utils';
import { env } from 'src/config/env';
import { UserPublicOutputDto } from 'src/users/dto/output/user-output.dto';
import { plainToInstance } from 'class-transformer';
import { ClientPublicOutputDto } from './dto/output/client-output.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async create(createClientDto: CreateClientDto) {
    this.logger.log('[create] Starting client signup transaction');

    const normalizedEmail = createClientDto.email.toLocaleLowerCase().trim();

    const existingUser = await this.userModel.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      this.logger.log(
        `[create] User with email=${normalizedEmail} exists already`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.EXISTS_ALREADY,
        message: 'User with this email already exists',
      });
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const { firstName, lastName, password } = createClientDto;

      this.logger.log(
        `[create] Checking if user with email=${normalizedEmail} exists already`,
      );

      const hashedPassword = await bcrypt.hash(password, 10);

      this.logger.log(`[create] Creating user with email=${normalizedEmail}`);

      // Create the User document
      const user = new this.userModel({
        firstName,
        lastName,
        email: normalizedEmail,
        password: hashedPassword,
        role: EnumUserRole.CLIENT,
        authType: EnumAuthType.EMAIL_PASSWORD,
        active: true,
      });
      await user.save({ session });
      this.logger.log(`[create] Created user id=${user._id}`);

      // Create the Client document linked to the user
      const client = new this.clientModel({
        user: user._id,
      });
      await client.save({ session });

      this.logger.log(
        `[create] Created client id=${client._id} for user id=${user._id}`,
      );

      await session.commitTransaction();
      this.logger.log(
        '[create] Client signup transaction committed successfully',
      );

      this.logger.log('[create] Generating tokens...');
      const accessToken = JWTUtils.createToken(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          clientId: client._id.toString(),
        },
        env.accessTokenSecret,
        env.accessTokenDurationMins,
      );
      const refreshToken = JWTUtils.createToken(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        env.refreshTokenSecret,
        env.refreshTokenDurationMins,
      );

      user.token = refreshToken;
      await user.save();

      const publicUser = plainToInstance(UserPublicOutputDto, user, {
        excludeExtraneousValues: true,
      });

      const publicClient = plainToInstance(ClientPublicOutputDto, client, {
        excludeExtraneousValues: true,
      });

      return OrchestrationResult.Success<{
        accessToken: string;
        refreshToken: string;
        user: UserPublicOutputDto;
        client: ClientPublicOutputDto;
      }>({
        statusCode: EnumStatusCode.LOGGED_IN_SUCCESSFULLY,
        data: {
          accessToken,
          refreshToken,
          user: publicUser,
          client: publicClient,
        },
        message: 'Client account created successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(
        `[create] Error during client signup: ${error?.message}`,
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
}

// Go back to the user and implement the login and /token route.
// Manage the middleware.
