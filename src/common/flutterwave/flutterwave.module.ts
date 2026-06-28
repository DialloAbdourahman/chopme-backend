import { Global, Module } from '@nestjs/common';
import { FlutterwaveService } from './flutterwave.service';
import { HttpModule } from '@nestjs/axios';

@Global()
@Module({
  imports: [HttpModule],
  providers: [FlutterwaveService],
  exports: [FlutterwaveService],
})
export class FlutterwaveModule {}
