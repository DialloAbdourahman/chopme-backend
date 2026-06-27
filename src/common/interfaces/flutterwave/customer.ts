export interface CustomerName {
  first: string;
  middle?: string;
  last: string;
}

export interface CustomerPhone {
  country_code: string;
  number: string;
}

export interface CustomerAddress {
  city: string;
  country: string;
  line1: string;
  line2?: string;
  postal_code: string;
  state: string;
}

export interface CreateCustomerRequest {
  name?: CustomerName;
  phone?: CustomerPhone;
  email: string;
  address?: CustomerAddress;
}

export interface Customer {
  id: string;
  name: CustomerName;
  phone: CustomerPhone;
  email: string;
  address: CustomerAddress;
  meta: Record<string, any>;
  created_datetime: string;
}
