import { EnumWebhookEventType } from '../../enums/webhook-event-types';
import { EnumWebhookStatus } from '../../enums/webhook-statuses';
import { WebhookCustomer } from './customer';
import { WebhookCard } from './card';

export interface WebhookData {
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
  status: EnumWebhookStatus;
  payment_type: string;
  created_at: string;
  account_id: number;
  customer: WebhookCustomer;
  card?: WebhookCard;
}

export interface FlutterwaveWebhook {
  event: EnumWebhookEventType;
  data: WebhookData;
}
