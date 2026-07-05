import { EnumFlwWebhookEventType } from '../../enums/flutterwave/flw-webhook-event-types';
import { EnumFlwPaymentWebhookStatus } from '../../enums/flutterwave/flw-payment-webhook-statuses';
import { WebhookCustomer } from './customer';
import { WebhookCard } from './card';
import { EnumCurrency } from 'src/common/enums/currencies';
import { EnumFlwTransferWebhookStatus } from 'src/common/enums/flutterwave/flw-transfer-webhook-status';
import { FlutterwaveBulkTransferMetaData } from './transfer';
import { EnumFlwRefundWebhookStatus } from 'src/common/enums/flutterwave/flw-refund-webhook-status';

export interface PaymentWebhookData {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  currency: string;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  ip: string;
  narration: string;
  status: EnumFlwPaymentWebhookStatus;
  payment_type: string;
  created_at: string;
  account_id: number;
  customer: WebhookCustomer;
  card?: WebhookCard;
}

export interface TransferWebhookData {
  id: number;
  account_number: string;
  bank_name: string;
  bank_code: string;
  fullname: string;
  created_at: string;
  currency: EnumCurrency;
  debit_currency: string;
  amount: number;
  fee: number;
  status: EnumFlwTransferWebhookStatus;
  reference: string;
  meta: FlutterwaveBulkTransferMetaData;
  narration: string;
  approver: string | null;
  complete_message: string;
  requires_approval: 0 | 1;
  is_approved: 0 | 1;
}

export interface RefundWebhookData {
  id: number;
  AmountRefunded: number;
  status: EnumFlwRefundWebhookStatus;
  FlwRef: string;
  destination: string;
  comments: string | null;
  settlement_id: string;
  meta: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  walletId: number;
  AccountId: number;
  TransactionId: number;
}

export interface FlutterwaveWebhook<T> {
  event: EnumFlwWebhookEventType;
  data: T;
}
