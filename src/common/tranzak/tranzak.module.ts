import { DynamicModule, Global, Module } from '@nestjs/common';
import { TranzakService } from './tranzak.service';
import { HttpModule, HttpService } from '@nestjs/axios';

export interface TranzakModuleOptions {
  baseUrl: string;
  appId: string;
  apiKey: string;
}

@Global()
@Module({})
export class TranzakModule {
  static forRoot(options: TranzakModuleOptions): DynamicModule {
    return {
      module: TranzakModule,
      imports: [HttpModule],
      providers: [
        {
          provide: TranzakService,
          useFactory: (httpService: HttpService) =>
            new TranzakService(
              httpService,
              options.baseUrl,
              options.appId,
              options.apiKey,
            ),
          inject: [HttpService],
        },
      ],
      exports: [TranzakService],
    };
  }
}
