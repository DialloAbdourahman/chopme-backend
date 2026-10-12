import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTranzakPaymentStatus } from 'src/common/enums/tranzak/payment-status';

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
