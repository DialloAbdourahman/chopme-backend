import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FcmTokensService } from './fcm-tokens.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from '../common/interfaces/loggedin-user-token-data';
import { CreateFcmTokenDto } from './dto/input/create-fcm-token.dto';

@Controller('fcm-tokens')
export class FcmTokensController {
  constructor(private readonly fcmTokensService: FcmTokensService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  register(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createFcmTokenDto: CreateFcmTokenDto,
  ) {
    return this.fcmTokensService.register(user, createFcmTokenDto);
  }
}
