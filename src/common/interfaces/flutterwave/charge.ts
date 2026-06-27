import { EnumChargeStatus } from 'src/common/enums/charge-statuses';
import { EnumCurrency } from '../../enums/currencies';

export interface ChargeFee {
  type: string;
  amount: number;
}

export interface ChargeNextAction {
  type: string;
  payment_instruction: {
    note: string;
  };
}

export interface ChargePaymentMethodDetails {
  type: string;
  mobile_money: {
    network: string;
    country_code: string;
    phone_number: string;
  };
  id: string;
  meta: Record<string, any>;
  created_datetime: string;
}

export interface ChargeProcessorResponse {
  type: string;
  code: string;
}

export interface Charge {
  id: string;
  amount: number;
  fees: ChargeFee[];
  currency: EnumCurrency;
  customer_id: string;
  settled: boolean;
  settlement_id: string[];
  meta: Record<string, any>;
  next_action: ChargeNextAction;
  payment_method_details: ChargePaymentMethodDetails;
  reference: string;
  status: EnumChargeStatus;
  processor_response: ChargeProcessorResponse;
  created_datetime: string;
}

export interface CreateChargeRequest {
  currency: EnumCurrency;
  customer_id: string;
  payment_method_id: string;
  amount: number;
  reference: string;
}
