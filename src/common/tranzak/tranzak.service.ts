import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import {
  ITranzakApiTokenResponse,
  ITranzakCreateTokenRequestDto,
} from '../interfaces/tranzak/token';
import { ITranzakApiResponse } from '../interfaces/tranzak/response';
import {
  ITranzakCreatePaymentSessionRequestDto,
  ITranzakCreatePaymentSessionResponseData,
} from '../interfaces/tranzak/payment';

@Injectable()
export class TranzakService implements OnModuleInit {
  private readonly logger = new Logger(TranzakService.name);

  private paymentToken: string | null = null;
  private paymentTokenExpiry: number | null = null;
  private timeoutMs: number = 10000;

  constructor(
    private readonly httpService: HttpService,
    private readonly baseUrl: string,
    private readonly appId: string,
    private readonly apiKey: string,
  ) {}

  onModuleInit() {
    this.logger.log('Tranzak initialized');
  }

  protected async getPaymentToken(): Promise<string> {
    const now = Date.now();

    // Reuse token if still valid
    if (
      this.paymentToken &&
      this.paymentTokenExpiry &&
      now < this.paymentTokenExpiry
    ) {
      this.logger.log('[Tranzak] Reusing existing payment token');
      return this.paymentToken;
    }

    try {
      this.logger.log('[Tranzak] Requesting new payment token');

      const data: ITranzakCreateTokenRequestDto = {
        appId: this.appId,
        appKey: this.apiKey,
      };

      const response = await firstValueFrom(
        this.httpService.post<ITranzakApiResponse<ITranzakApiTokenResponse>>(
          `${this.baseUrl}/auth/token`,
          data,
          { timeout: this.timeoutMs },
        ),
      );

      if (!response.data.success) {
        throw new Error(`Tranzak API error: ${response.data.errorMsg}`);
      }

      this.paymentToken = response.data.data.token;
      this.paymentTokenExpiry = now + response.data.data.expiresIn * 1000;

      this.logger.log('[Tranzak] Payment token acquired successfully');

      return this.paymentToken;
    } catch (error) {
      this.logger.error(
        '[Tranzak] Error getting payment token:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async createPayment(
    data: ITranzakCreatePaymentSessionRequestDto,
  ): Promise<ITranzakCreatePaymentSessionResponseData> {
    try {
      this.logger.log('[Tranzak] Creating payment session');

      const paymentToken = await this.getPaymentToken();

      const response = await firstValueFrom(
        this.httpService.post<
          ITranzakApiResponse<ITranzakCreatePaymentSessionResponseData>
        >(`${this.baseUrl}/xp021/v1/request/create`, data, {
          headers: {
            Authorization: `Bearer ${paymentToken}`,
          },
          timeout: this.timeoutMs,
        }),
      );

      if (!response.data.success) {
        throw new Error(`Tranzak API error: ${response.data.errorMsg}`);
      }

      this.logger.log('[Tranzak] Payment session created');

      return response.data.data;
    } catch (error) {
      this.logger.error(
        '[Tranzak] Error creating payment session:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}

// {
//   requestId: 'REQ2610111754A1A2Z67',
//   amount: 2500,
//   currencyCode: 'XAF',
//   description: '{"email":"dialloabdourahmandev@gmail.com","name":"Diallo Abdourahman Dev"}',
//   mobileWalletNumber: null,
//   status: 'PENDING',
//   transactionStatus: 'PENDING',
//   createdAt: '2026-10-11T17:54:25+00:00',
//   mchTransactionRef: '6acbcd4f2d337258eb7af6f0',
//   appId: 'apr94h3whtlo8z',
//   payerNote: '',
//   serviceDiscountAmount: null,
//   receivingEntityName: null,
//   transactionTag: null,
//   links: {
//     returnUrl: 'http://localhost:5173/orders/6acbcd4f2d337258eb7af6f0',
//     cancelUrl: 'http://localhost:5173/orders/6acbcd4f2d337258eb7af6f0',
//     paymentAuthUrl: 'https://sandbox.pay.tranzak.me/?rid=REQ2610111754A1A2Z67'
//   }
// }
