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
import {
  ITranzakCreateRefundRequestDto,
  ITranzakCreateRefundResponseData,
} from '../interfaces/tranzak/refund';
import {
  ITranzakCreateTransferRequestDto,
  ITranzakCreateTransferResponseData,
} from '../interfaces/tranzak/transfer';

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

  async createRefund(
    data: ITranzakCreateRefundRequestDto,
  ): Promise<ITranzakCreateRefundResponseData> {
    try {
      this.logger.log(
        `[Tranzak] Creating refund for transaction ${data.refundedTransactionId}`,
      );

      const paymentToken = await this.getPaymentToken();

      const response = await firstValueFrom(
        this.httpService.post<
          ITranzakApiResponse<ITranzakCreateRefundResponseData>
        >(`${this.baseUrl}/xp021/v1/refund/create`, data, {
          headers: {
            Authorization: `Bearer ${paymentToken}`,
          },
          timeout: this.timeoutMs,
        }),
      );

      if (!response.data.success) {
        throw new Error(`Tranzak API error: ${response.data.errorMsg}`);
      }

      this.logger.log('[Tranzak] Refund created');

      return response.data.data;
    } catch (error) {
      this.logger.error(
        '[Tranzak] Error creating refund:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async createTransfer(
    data: ITranzakCreateTransferRequestDto,
  ): Promise<ITranzakCreateTransferResponseData> {
    try {
      this.logger.log(
        `[Tranzak] Creating transfer: amount=${data.amount}, payeeAccountId=${data.payeeAccountId}`,
      );

      const paymentToken = await this.getPaymentToken();

      const response = await firstValueFrom(
        this.httpService.post<
          ITranzakApiResponse<ITranzakCreateTransferResponseData>
        >(`${this.baseUrl}/xp021/v1/transfer/to-mobile-wallet`, data, {
          headers: {
            Authorization: `Bearer ${paymentToken}`,
          },
          timeout: this.timeoutMs,
        }),
      );

      if (!response.data.success) {
        throw new Error(`Tranzak API error: ${response.data.errorMsg}`);
      }

      this.logger.log('[Tranzak] Transfer created');

      return response.data.data;
    } catch (error) {
      this.logger.error(
        '[Tranzak] Error creating transfer:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
