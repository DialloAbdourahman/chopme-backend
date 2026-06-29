import { DynamicModule, Global, Module } from '@nestjs/common';
import { FlutterwaveService } from './flutterwave.service';
import { HttpModule, HttpService } from '@nestjs/axios';
import { env } from 'src/config/env';

export interface FlutterwaveModuleOptions {
  baseUrl: string;
  secretKey: string;
}

@Global()
@Module({})
export class FlutterwaveModule {
  static forRoot(options: FlutterwaveModuleOptions): DynamicModule {
    return {
      module: FlutterwaveModule,
      imports: [HttpModule],
      providers: [
        {
          provide: FlutterwaveService,
          useFactory: (httpService: HttpService) =>
            new FlutterwaveService(
              httpService,
              options.baseUrl,
              options.secretKey,
            ),
          inject: [HttpService],
        },
      ],
      exports: [FlutterwaveService],
    };
  }
}
