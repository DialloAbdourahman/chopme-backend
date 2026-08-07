import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FcmTokensController } from './fcm-tokens.controller';
import { FcmTokensService } from './fcm-tokens.service';
import { FcmToken, FcmTokenSchema } from './entities/fcm-token.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FcmToken.name, schema: FcmTokenSchema },
    ]),
  ],
  controllers: [FcmTokensController],
  providers: [FcmTokensService],
  exports: [FcmTokensService],
})
export class FcmTokensModule {}
