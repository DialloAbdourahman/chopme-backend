import { EnumTranzakTransferStatus } from 'src/common/enums/tranzak/transfer-status';
import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTranzakWebhookStatus } from 'src/common/enums/tranzak/webhook-status';

export interface ITranzakCreateTransferRequestDto {
  amount: number;
  currencyCode: EnumTranzakCurrency;
  description: string;
  customTransactionRef?: string;
  payeeAccountId: string;
  payeeAccountName?: string;
  verifyPayeeName?: boolean;
  payeeNote?: string;
  callbackUrl?: string;
  payeeFeePercentage?: number;
  sendSmsToPayee?: boolean;
  sms?: {
    mobileNumber?: string;
    content: string;
  };
}

export interface ITranzakCreateTransferResponseData {
  transferId: string;
  status: EnumTranzakTransferStatus;
  payeeAccountId: string;
  payeeAccountName?: string;
  destinationServiceName?: string;
  payeeNote?: string;
  description: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  fee: number;
  customTransactionRef?: string;
  createdByAppId?: string;
  type?: string;
  transactionId?: string;
  transactionTime?: string;
  createdAt?: string;
}

export interface ITranzakWebhookTransferResponse {
  transferId: string;
  status: EnumTranzakWebhookStatus;
  payeeAccountId: string;
  fundingAccountId?: string;
  payeeAccountName?: string;
  destinationServiceName?: string;
  payeeNote?: string;
  description: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  fee: number;
  customTransactionRef?: string;
  createdByAppId?: string;
  type?: 'account transfer' | 'mobile money transfer';
  transactionId?: string;
  transactionTime?: string;
  partnerTransactionId?: string;
  sendSmsToPayee?: boolean;
  smsContent?: string;
  smsMobileNumber?: string;
  payeeSmsSuccess?: boolean;
  createdAt?: string;
  errorMessage?: string;
  refundId?: string;
}
