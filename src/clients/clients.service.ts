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
import { env } from 'src/config/env';
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { ClientPublicOutputDto } from './dto/output/client-output.dto';
import { plainToInstance } from 'class-transformer';

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
      const { fullName, password } = createClientDto;

      this.logger.log(
        `[create] Checking if user with email=${normalizedEmail} exists already`,
      );

      const hashedPassword = await bcrypt.hash(password, 10);

      this.logger.log(`[create] Creating user with email=${normalizedEmail}`);

      // Create the User document
      const user = new this.userModel({
        fullName,
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

      return OrchestrationResult.Success<string>({
        statusCode: EnumStatusCode.CLIENT_CREATED_SUCCESSFULLY,
        data: 'Client account created successfully',
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

  async getMyClientProfile(user: ILoggedInUserTokenData) {
    this.logger.log(
      `[getMyClientProfile] Fetching client for user id=${user.id}`,
    );

    const client = await this.clientModel
      .findOne({
        user: new Types.ObjectId(user.id),
      })
      .populate('user');

    if (!client) {
      this.logger.log(
        `[getMyClientProfile] Client not found for user id=${user.id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Client not found',
        code: 404,
      });
    }

    const publicClient = plainToInstance(ClientPublicOutputDto, client, {
      excludeExtraneousValues: true,
    });

    console.log('yoo');

    console.log(publicClient);

    return OrchestrationResult.Success<ClientPublicOutputDto>({
      statusCode: EnumStatusCode.RECOVERED_SUCCESSFULLY,
      data: publicClient,
      message: 'Client profile fetched successfully',
    });
  }
}
