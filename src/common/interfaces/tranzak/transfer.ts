import { EnumTranzakBulkTransferStatus } from 'src/common/enums/tranzak/bulk-transfer-status';
import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTranzakWebhookStatus } from 'src/common/enums/tranzak/webhook-status';

export interface ITranzakBulkTransferRecipient {
  payeeAccountId: string;
  mobileNumber?: string;
  payeeAccountName?: string;
  amount: number;
  payeeNote: string;
  description: string;
  customTransactionRef: string;
  smsMobileNumber?: string;
}

export interface ITranzakCreateBulkTransferRequestDto {
  title: string;
  description: string;
  currencyCode: EnumTranzakCurrency;
  isPriority?: boolean;
  customTransactionRef?: string;
  recipients: ITranzakBulkTransferRecipient[];
  verifyPayeeName?: boolean;
  callbackUrl?: string;
  payeeFeePercentage?: number;
  sendSmsToPayee?: boolean;
  sms?: {
    mobileNumber?: string;
    content: string;
  };
}

export interface ITranzakBulkTransferRecipientResult {
  payeeAccountId: string;
  payeeAccountName?: string;
  amount: number;
  payeeNote?: string;
  description?: string;
  customTransactionRef?: string;
}

export interface ITranzakCreateBulkTransferResponseData {
  payoutId: string;
  title: string;
  currencyCode: EnumTranzakCurrency;
  mchTransactionRef?: string;
  description?: string;
  feeIsPaidByPayee?: boolean;
  isPriority?: boolean;
  totalNumberOfRecipients?: number;
  totalNumberFailedTransactions?: number;
  totalFailedTransactionAmount?: number;
  transactionId?: string;
  transactionTime?: string;
  isCreatedViaFileUpload?: boolean;
  appId?: string;
  fundingAccountId?: string;
  status: EnumTranzakBulkTransferStatus;
  totalAmount: number;
  priorityFee?: number;
  totalRecipientFee?: number;
  totalFee?: number;
  type?: string;
  reportFile?: string;
  createdAt?: string;
  completedAt?: string;
  sendSmsToPayee?: boolean;
  smsContent?: string;
  refundId?: string;
  totalRefundedAmount?: number;
  recipients?: ITranzakBulkTransferRecipientResult[];
}

export interface ITranzakWebhookBulkTransferResponse {
  payoutId?: string;
  title?: string;
  currencyCode?: EnumTranzakCurrency;
  mchTransactionRef?: string;
  description?: string;
  feeIsPaidByPayee?: boolean;
  isPriority?: boolean;
  totalNumberOfRecipients?: number;
  totalNumberFailedTransactions?: number;
  totalFailedTransactionAmount?: number;
  transactionId?: string;
  transactionTime?: string;
  isCreatedViaFileUpload?: boolean;
  appId?: string;
  fundingAccountId?: string;
  status?: EnumTranzakWebhookStatus;
  totalAmount?: number;
  priorityFee?: number;
  totalRecipientFee?: number;
  totalFee?: number;
  type?: string;
  reportFile?: string;
  createdAt?: string;
  completedAt?: string;
  sendSmsToPayee?: boolean;
  smsContent?: string;
  refundId?: string;
  totalRefundedAmount?: number;
  recipients?: ITranzakBulkTransferRecipientResult[];
}
