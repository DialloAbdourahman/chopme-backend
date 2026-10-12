import { EnumRefundStatus } from 'src/common/enums/refund-statuses';
import { EnumTranzakCurrency } from 'src/common/enums/tranzak/currency';
import { EnumTranzakReasonCode } from 'src/common/enums/tranzak/reason';
import { EnumTranzakWebhookRefundStatus } from 'src/common/enums/tranzak/refund-webhook-status';

export interface ITranzakCreateRefundRequestDto {
  refundedTransactionId: string;
  reasonCode: EnumTranzakReasonCode;
  merchantRefundNumber: string;
  note?: string;
  amount?: number;
}

export interface ITranzakCreateRefundResponseData {
  refundId: string;
  refundedTransactionId: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  status: EnumRefundStatus;
  type: 'REFUND';
  merchantRefundRef: string;
  reasonDescription: string;
  isInitiatedByText: string;
  isCancelledByText: string;
  isApprovedByText: string;
  note: string;
  reasonCode: EnumTranzakReasonCode;
  createdAt: string;
  approvedAt: string;
}

export interface ITranzakWebhookRefundResponse {
  refundId: string;
  refundedTransactionId: string;
  serviceId: string;
  amount: number;
  currencyCode: EnumTranzakCurrency;
  status: EnumTranzakWebhookRefundStatus;
  type: 'REFUND';
  merchantRefundRef: string | null;
  reasonDescription: string;
  isInitiatedByText: string;
  isCancelledByText: string | null;
  isApprovedByText: string;
  note: string;
  reasonCode: EnumTranzakReasonCode;
  reason: string;
  createdAt: string;
  approvedAt: string;
}
