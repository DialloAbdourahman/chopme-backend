import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/input/create-client.dto';
import { UpdateAddressDto } from './dto/input/update-address.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ILoggedInUserTokenData } from 'src/common/interfaces/loggedin-user-token-data';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { EnumUserRole } from 'src/common/enums/user-roles';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body(new ValidationPipe()) createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get('me')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  me(@CurrentUser() user: ILoggedInUserTokenData) {
    return this.clientsService.getMyClientProfile(user);
  }

  @Patch('me/location')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(EnumUserRole.CLIENT)
  updateMe(
    @CurrentUser() user: ILoggedInUserTokenData,
    @Body(new ValidationPipe()) updateClientDto: UpdateAddressDto,
  ) {
    return this.clientsService.updateMyClientLocation(user, updateClientDto);
  }
}
