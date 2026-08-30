export type ContactRole = 'customer' | 'supplier';
export type InvoiceType = 'sales' | 'purchase' | 'proforma';
export type InvoiceStatus = 'open' | 'paid' | 'partial' | 'converted' | 'cancelled';
export type PaymentDirection = 'receipt' | 'payment';
export type PaymentMethod = 'cash' | 'card' | 'transfer';
export type DiscountType = 'percent' | 'fixed';

export interface Settings {
  id: number;
  business_name: string;
  economic_code: string | null;
  national_id: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  default_vat_rate: number;
  updated_at: string;
  // Print settings
  print_paper_size: 'A4' | 'A5';
  print_show_logo: boolean;
  print_show_seller_contact: boolean;
  print_show_buyer_national_id: boolean;
  print_show_product_code: boolean;
  print_show_tax_column: boolean;
  print_show_discount_column: boolean;
  print_show_previous_balance: boolean;
  print_show_signatures: boolean;
  print_default_notes: string[];
}

export interface Contact {
  id: string;
  code: number | null;
  full_name: string;
  company: string | null;
  phone: string | null;
  address: string | null;
  national_id: string | null;
  role: ContactRole;
  initial_balance: number;
  balance: number;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  low_stock_threshold: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: InvoiceType;
  date: string;
  contact_id: string | null;
  seller_name: string | null;
  seller_national_id: string | null;
  seller_phone: string | null;
  seller_address: string | null;
  buyer_name: string | null;
  buyer_national_id: string | null;
  buyer_phone: string | null;
  buyer_address: string | null;
  subtotal: number;
  total_discount: number;
  total_tax: number;
  payable: number;
  global_discount_type: 'amount' | 'percent';
  global_discount_value: number;
  global_tax_type: 'amount' | 'percent';
  global_tax_value: number;
  notes: string | null;
  status: InvoiceStatus;
  converted_from: string | null;
  created_at: string;
  contact?: Pick<Contact, 'id' | 'full_name' | 'role' | 'code'>;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  sku: string | null;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

export interface Payment {
  id: string;
  number: string;
  date: string;
  contact_id: string;
  invoice_id: string | null;
  direction: PaymentDirection;
  method: PaymentMethod;
  amount: number;
  notes: string | null;
  created_at: string;
  contact?: Pick<Contact, 'id' | 'full_name' | 'role'>;
  invoice?: Pick<Invoice, 'id' | 'number' | 'type'>;
}

export interface InvoiceLineItem {
  key: string;
  product_id: string | null;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate: number;
}

export interface GlobalTotalsConfig {
  discount_type: 'amount' | 'percent';
  discount_value: number;
  tax_type: 'amount' | 'percent';
  tax_value: number;
}
