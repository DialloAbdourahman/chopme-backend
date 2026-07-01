export interface FlutterwaveRefund {
  id: number;
  account_id: number;
  tx_id: number;
  flw_ref: string;
  wallet_id: number;
  amount_refunded: number;
  status: 'completed';
  destination: string;
  meta: {
    source: string;
  };
  created_at: string; // ISO 8601 date string
}
