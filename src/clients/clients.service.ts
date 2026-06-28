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
import { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { ClientPublicOutputDto } from './dto/output/client-output.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateAddressDto } from './dto/input/update-address.dto';

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

    const clientObject = client.toObject();

    const publicClient = plainToInstance(ClientPublicOutputDto, clientObject, {
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

  async updateMyClientLocation(
    user: ILoggedInUserTokenData,
    updateClientDto: UpdateAddressDto,
  ) {
    this.logger.log(
      `[updateMyClientLocation] Updating client location for user id=${user.id}`,
    );

    const client = await this.clientModel
      .findOne({
        user: new Types.ObjectId(user.id),
      })
      .populate('user');

    if (!client) {
      this.logger.log(
        `[updateMyClientLocation] Client not found for user id=${user.id}`,
      );
      throw new OrchestrationException({
        statusCode: EnumStatusCode.NOT_FOUND,
        message: 'Client not found',
        code: 404,
      });
    }

    const currentAddress = client.address || ({} as any);

    currentAddress.longitude = Number(updateClientDto.longitude);
    currentAddress.latitude = Number(updateClientDto.latitude);

    client.address = currentAddress;
    await client.save();

    const clientObject = client.toObject();

    const publicClient = plainToInstance(ClientPublicOutputDto, clientObject, {
      excludeExtraneousValues: true,
    });

    return OrchestrationResult.Success<ClientPublicOutputDto>({
      statusCode: EnumStatusCode.UPDATED_SUCCESSFULLY,
      data: publicClient,
      message: 'Client profile updated successfully',
    });
  }
}
