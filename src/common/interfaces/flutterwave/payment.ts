import { EnumCurrency } from 'src/common/enums/currencies';

export interface Customer {
  email: string;
  name: string;
  phonenumber?: string;
}

export interface Customizations {
  title: string;
}

export interface CreatePaymentRequest {
  tx_ref: string;
  amount: string;
  currency: EnumCurrency;
  redirect_url: string;
  customer: Customer;
  customizations: Customizations;
  session_duration: number;
  meta?: Record<string, unknown>;
}

export interface PaymentResponse {
  link: string;
}
