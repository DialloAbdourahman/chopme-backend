import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTranzakPaymentStatus } from 'src/common/enums/tranzak/payment-status';
import { EnumTranzakWebhookStatus } from 'src/common/enums/tranzak/webhook-status';

export interface ITranzakCreatePaymentSessionRequestDto {
  amount: number;
  currencyCode: EnumTranzakCurrency;
  description: string;
  mchTransactionRef: string;
  returnUrl: string;
  cancelUrl: string;
  customization?: {
    logoUrl?: string;
    title?: string;
  };
}

export interface ITranzakCreatePaymentSessionResponseData {
  requestId: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  description: string;
  mobileWalletNumber: string | null;
  status: EnumTranzakPaymentStatus;
  transactionStatus: EnumTranzakPaymentStatus;
  createdAt: string;
  mchTransactionRef: string;
  appId: string;
  payerNote: string;
  serviceDiscountAmount: number | null;
  receivingEntityName: string | null;
  transactionTag: string | null;
  links: {
    returnUrl: string;
    cancelUrl: string;
    paymentAuthUrl: string;
  };
}

export interface ITranzakWebhookPaymentResponse {
  requestId?: string;
  amount?: number;
  currencyCode?: EnumTranzakCurrency;
  description?: string;
  mobileWalletNumber?: string | null;
  status?: EnumTranzakWebhookStatus;
  transactionStatus?: EnumTranzakPaymentStatus;
  createdAt?: string;
  mchTransactionRef?: string;
  appId?: string;
  payerNote?: string;
  serviceDiscountAmount?: number | null;
  payerFeePercentage?: number;
  invoiceId?: string;
  receivingAccountId?: string;
  receivingEntityName?: string | null;
  transactionTag?: string | null;
  transactionId?: string;
  transactionTime?: string;
  partnerTransactionId?: string;
  payer?: {
    isGuest?: boolean;
    userId?: string;
    name?: string;
    paymentMethod?: string;
    currencyCode?: string;
    countryCode?: string;
    accountId?: string;
    accountName?: string;
    email?: string | null;
    amount?: number;
    discount?: number;
    fee?: number;
    netAmountPaid?: number;
  };
  merchant?: {
    currencyCode?: string;
    amount?: number;
    fee?: number;
    netAmountReceived?: number;
    accountId?: string;
  };
  links?: {
    returnUrl?: string;
    cancelUrl?: string;
  };
  errorCode?: number;
  errorMessage?: string;
}
