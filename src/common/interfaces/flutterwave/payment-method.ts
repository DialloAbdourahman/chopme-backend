export interface MobileMoneyDetails {
  country_code: string;
  network: string;
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
