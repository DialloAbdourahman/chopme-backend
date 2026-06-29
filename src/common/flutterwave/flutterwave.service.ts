import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { FlutterWaveResponse } from '../interfaces/flutterwave/response';
import {
  CreatePaymentRequest,
  PaymentResponse,
} from '../interfaces/flutterwave/payment';

@Injectable()
export class FlutterwaveService implements OnModuleInit {
  private readonly logger = new Logger(FlutterwaveService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly baseUrl: string,
    private readonly secretKey: string,
  ) {}

  onModuleInit() {
    this.logger.log('Flutterwave initialized');
  }

  async createPayment(
    paymentData: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    try {
      this.logger.log(
        `[Flutterwave] Creating payment for transaction reference: ${paymentData.tx_ref}, amount: ${paymentData.amount} ${paymentData.currency}`,
      );

      const response = await firstValueFrom(
        this.httpService.post<FlutterWaveResponse<PaymentResponse>>(
          `${this.baseUrl}/payments`,
          paymentData,
          {
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (response.data.status !== 'success') {
        throw new Error(
          `Flutterwave API error: ${response.data.message} ${response?.data?.error}`,
        );
      }

      this.logger.log(
        `[Flutterwave] Successfully created payment with hosted link: ${response.data.data.link}`,
      );

      return response.data.data;
    } catch (error) {
      this.logger.error(
        '[Flutterwave] Error creating payment:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
