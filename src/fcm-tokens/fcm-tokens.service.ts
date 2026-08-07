import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FcmToken, FcmTokenDocument } from './entities/fcm-token.entity';
import { ILoggedInUserTokenData } from '../common/interfaces/loggedin-user-token-data';
import { OrchestrationResult } from '../common/utils/orchestration.result';
import { EnumStatusCode } from '../common/enums/response-status-code';
import { CreateFcmTokenDto } from './dto/input/create-fcm-token.dto';

@Injectable()
export class FcmTokensService {
  private readonly logger = new Logger(FcmTokensService.name);

  constructor(
    @InjectModel(FcmToken.name)
    private readonly fcmTokenModel: Model<FcmTokenDocument>,
  ) {}

  async register(
    user: ILoggedInUserTokenData,
    createFcmTokenDto: CreateFcmTokenDto,
  ) {
    this.logger.log(
      `[register] Registering FCM installation for user id=${user.id}`,
    );

    const existingInstallation = await this.fcmTokenModel.findOne({
      user: new Types.ObjectId(user.id),
      installationId: createFcmTokenDto.installationId,
    });

    if (existingInstallation) {
      return OrchestrationResult.Success({
        statusCode: EnumStatusCode.EXISTS_ALREADY,
        data: null,
        message: 'FCM installation already registered',
      });
    }

    await this.fcmTokenModel.create({
      user: new Types.ObjectId(user.id),
      installationId: createFcmTokenDto.installationId,
    });

    return OrchestrationResult.Success({
      statusCode: EnumStatusCode.CREATED_SUCCESSFULLY,
      data: null,
      message: 'FCM installation registered successfully',
    });
  }

  async findInstallationIdsByUserId(userId: string): Promise<string[]> {
    const installations = await this.fcmTokenModel
      .find({ user: new Types.ObjectId(userId) })
      .lean();

    return installations.map((installation) => installation.installationId);
  }
}
