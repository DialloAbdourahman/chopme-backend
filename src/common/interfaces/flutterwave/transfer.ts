import { EnumCurrency } from 'src/common/enums/currencies';

export interface FlutterwaveTransfer {
  id: number;
  account_number: string;
  bank_code: string;
  full_name: string;
  created_at: string;
  currency: EnumCurrency;
  amount: number;
  fee: number;
  status: 'NEW';
  reference: string;
  meta: Record<string, unknown> | null;
  narration: string;
  complete_message: string;
  requires_approval: number;
  is_approved: number;
  bank_name: string;
}

export interface FlutterwaveBulkTransferMetaData {
  transferId: string;
  direction: 'platform' | 'restaurant';
}

export interface FlutterwaveBulkTransfer {
  id: number;
  approver: string;
  created_at: string;
}
