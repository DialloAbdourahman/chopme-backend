import { Injectable } from '@nestjs/common';
import { CreateTransferDto } from './dto/input/create-transfer.dto';

@Injectable()
export class TransfersService {
  create(createTransferDto: CreateTransferDto) {
    return 'This action adds a new transfer';
  }
}
