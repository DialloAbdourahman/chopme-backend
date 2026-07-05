import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/input/create-transfer.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  create(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body() createTransferDto: CreateTransferDto,
  ) {
    return this.transfersService.create({ createTransferDto, user });
  }

  @Post(':transferId/start-transfer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.ADMIN)
  startTransfer(
    @Param('transferId') transferId: string,
    @CurrentUser() user: ILoggedInUserTokenData,
  ) {
    return this.transfersService.startTransfer({ transferId, user });
  }
}
