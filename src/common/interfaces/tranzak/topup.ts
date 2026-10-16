import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTranzakTopupStatus } from 'src/common/enums/tranzak/topup-status';

export interface ITranzakCreateTopupRequestDto {
  amount: number;
  currencyCode: EnumTranzakCurrency;
  description: string;
  customTransactionRef: string;
  payeeNote: string;
}

export interface ITranzakCreateTopupResponseData {
  transferId: string;
  status: EnumTranzakTopupStatus;
  payeeAccountId: string;
  fundingAccountId: string;
  payeeAccountName: string | null;
  destinationServiceName: string;
  payeeNote: string;
  description: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  fee: number;
  customTransactionRef: string;
  feeIsPaidByPayee: boolean;
  createdByAppId: string;
  payoutId: string | null;
  payeeFeePercentage: number | null;
  type: string;
  transactionId: string;
  transactionTime: string;
  partnerTransactionId: string;
  sms: string | null;
  verifyPayeeName: boolean;
  createdAt: string;
}

export interface ITranzakWebhookTopupResponse {
  transferId: string;
  status: EnumTranzakTopupStatus;
  payeeAccountId: string;
  fundingAccountId: string;
  payeeAccountName: string | null;
  destinationServiceName: string;
  payeeNote: string;
  description: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  fee: number;
  customTransactionRef: string;
  feeIsPaidByPayee: boolean;
  createdByAppId: string;
  payoutId: string | null;
  payeeFeePercentage: number | null;
  type: string;
  transactionId: string;
  transactionTime: string;
  partnerTransactionId: string;
  sms: string | null;
  verifyPayeeName: boolean;
  createdAt: string;
}
