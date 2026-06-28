import { EnumNetwork } from '../../enums/networks';

export interface MobileMoneyDetails {
  country_code: string;
  network: EnumNetwork;
  phone_number: string;
}

export interface CreatePaymentMethodRequest {
  type: 'mobile_money' | 'bank_transfer' | 'card';
  mobile_money: MobileMoneyDetails;
}

export interface PaymentMethod {
  id: string;
  type: string;
  mobile_money: MobileMoneyDetails;
  meta: Record<string, any>;
  created_datetime: string;
}
