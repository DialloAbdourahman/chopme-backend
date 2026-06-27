import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { Observable, firstValueFrom } from 'rxjs';
import { FlutterWaveAuthResponse } from '../interfaces/flutterwave/auth';
import { FlutterWaveResponse } from '../interfaces/flutterwave/response';
import {
  CreateCustomerRequest,
  Customer,
} from '../interfaces/flutterwave/customer';
import {
  CreatePaymentMethodRequest,
  PaymentMethod,
} from '../interfaces/flutterwave/payment-method';
import { Charge, CreateChargeRequest } from '../interfaces/flutterwave/charge';
import { env } from 'src/config/env';

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  constructor(private readonly httpService: HttpService) {}

  private readonly baseUrl = process.env.FLUTTER_WAVE_URL;
  private token: string | null = null;
  private expiresAt: Date | null = null;

  private async refreshToken(): Promise<void> {
    try {
      this.logger.log('[Flutterwave] Refreshing Flutterwave access token...');

      const response = await firstValueFrom(
        this.httpService.post<FlutterWaveAuthResponse>(
          env.flutterWaveAuthUrl,
          new URLSearchParams({
            client_id: env.flutterWaveClientId,
            client_secret: env.flutterWaveClientSecret,
            grant_type: env.flutterWaveGrantType,
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      const { access_token, expires_in } = response.data;

      this.token = access_token;
      // Set expiresAt to current time plus expires_in seconds minus 60 seconds buffer
      this.expiresAt = new Date(Date.now() + (expires_in - 60) * 1000);

      this.logger.log(
        `[Flutterwave] New Flutterwave token obtained, expires at ${this.expiresAt.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        '[Flutterwave] Error refreshing Flutterwave token:',
        error.response?.data || error.message || error.error,
      );
      throw error;
    }
  }

  private async ensureTokenIsValid(): Promise<void> {
    const now = new Date();

    // If no token or token is expired or will expire within 1 minute, refresh it
    if (!this.token || !this.expiresAt || now >= this.expiresAt) {
      await this.refreshToken();
    } else {
      const timeUntilExpiry = this.expiresAt.getTime() - now.getTime();
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60));
      this.logger.log(
        `[Flutterwave] Flutterwave token is still valid for ${minutesUntilExpiry} minutes`,
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    await this.ensureTokenIsValid();

    if (!this.token) {
      throw new Error('Failed to obtain Flutterwave access token');
    }

    return this.token;
  }

  async createCustomer({
    customerData,
    uniqueIdentifier,
  }: {
    customerData: CreateCustomerRequest;
    uniqueIdentifier: string;
  }): Promise<Customer> {
    try {
      this.logger.log(
        `[Flutterwave] Creating Flutterwave customer for email: ${customerData.email}`,
      );

      const accessToken = await this.getAccessToken();

      const response = await firstValueFrom(
        this.httpService.post<FlutterWaveResponse<Customer>>(
          `${env.flutterWaveUrl}/customers`,
          customerData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Trace-Id': uniqueIdentifier,
            },
          },
        ),
      );

      const { data } = response.data;

      if (response.data.status !== 'success') {
        throw new Error(`Flutterwave API error: ${response.data.error}`);
      }

      this.logger.log(
        `[Flutterwave] Successfully created Flutterwave customer with ID: ${data.id}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        '[Flutterwave] Error creating Flutterwave customer:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async createPaymentMethod({
    paymentMethodData,
    uniqueIdentifier,
    idempotencyKey,
  }: {
    paymentMethodData: CreatePaymentMethodRequest;
    uniqueIdentifier: string;
    idempotencyKey: string;
  }): Promise<PaymentMethod> {
    try {
      this.logger.log(
        `[Flutterwave] Creating Flutterwave payment method of type: ${paymentMethodData.type}`,
      );

      const accessToken = await this.getAccessToken();

      const response = await firstValueFrom(
        this.httpService.post<FlutterWaveResponse<PaymentMethod>>(
          `${env.flutterWaveUrl}/payment-methods`,
          paymentMethodData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Trace-Id': uniqueIdentifier,
              'X-Idempotency-Key': idempotencyKey,
            },
          },
        ),
      );

      const { data } = response.data;

      if (response.data.status !== 'success') {
        throw new Error(`Flutterwave API error: ${response.data.error}`);
      }

      this.logger.log(
        `[Flutterwave] Successfully created Flutterwave payment method with ID: ${data.id}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        '[Flutterwave] Error creating Flutterwave payment method:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async createCharge({
    chargeData,
    uniqueIdentifier,
    idempotencyKey,
  }: {
    chargeData: CreateChargeRequest;
    uniqueIdentifier: string;
    idempotencyKey: string;
  }): Promise<Charge> {
    try {
      this.logger.log(
        `[Flutterwave] Creating Flutterwave charge for customer: ${chargeData.customer_id}, amount: ${chargeData.amount}`,
      );

      const accessToken = await this.getAccessToken();

      const response = await firstValueFrom(
        this.httpService.post<FlutterWaveResponse<Charge>>(
          `${env.flutterWaveUrl}/charges`,
          chargeData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Trace-Id': uniqueIdentifier,
              'X-Idempotency-Key': idempotencyKey,
            },
          },
        ),
      );

      const { data } = response.data;

      if (response.data.status !== 'success') {
        throw new Error(`Flutterwave API error: ${response.data.error}`);
      }

      this.logger.log(
        `[Flutterwave] Successfully created Flutterwave charge with ID: ${data.id}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        '[Flutterwave] Error creating Flutterwave charge:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
