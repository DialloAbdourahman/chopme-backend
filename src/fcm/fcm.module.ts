import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FcmService } from './fcm.service';
import {
  FcmToken,
  FcmTokenSchema,
} from '../fcm-tokens/entities/fcm-token.entity';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FcmToken.name, schema: FcmTokenSchema },
    ]),
  ],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
