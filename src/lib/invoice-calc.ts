import type { InvoiceLineItem, GlobalTotalsConfig } from './types';

export interface LineCalculation {
  discount_amount: number;
  tax_amount: number;
  total: number;
  gross: number;
}

export function calculateLine(line: InvoiceLineItem): LineCalculation {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unit_price) || 0;
  const gross = qty * price;

  let discountAmount = 0;
  if (line.discount_type === 'percent') {
    discountAmount = (gross * (Number(line.discount_value) || 0)) / 100;
  } else {
    discountAmount = Number(line.discount_value) || 0;
  }
  discountAmount = Math.min(discountAmount, gross);

  const afterDiscount = gross - discountAmount;
  const taxAmount = (afterDiscount * (Number(line.tax_rate) || 0)) / 100;
  const total = afterDiscount + taxAmount;

  return {
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total,
    gross,
  };
}

export interface InvoiceTotals {
  subtotal: number;
  line_discount: number;
  line_tax: number;
  global_discount: number;
  global_tax: number;
  total_discount: number;
  total_tax: number;
  payable: number;
}

export function calculateInvoiceTotals(
  lines: InvoiceLineItem[],
  global?: GlobalTotalsConfig,
): InvoiceTotals {
  let subtotal = 0;
  let lineDiscount = 0;
  let lineTax = 0;

  for (const line of lines) {
    const calc = calculateLine(line);
    subtotal += calc.gross;
    lineDiscount += calc.discount_amount;
    lineTax += calc.tax_amount;
  }

  const afterLineDiscount = subtotal - lineDiscount;

  let globalDiscount = 0;
  if (global) {
    if (global.discount_type === 'percent') {
      globalDiscount = (afterLineDiscount * (Number(global.discount_value) || 0)) / 100;
    } else {
      globalDiscount = Number(global.discount_value) || 0;
    }
  }
  globalDiscount = Math.min(globalDiscount, afterLineDiscount);

  const afterAllDiscount = afterLineDiscount - globalDiscount;

  let globalTax = 0;
  if (global) {
    if (global.tax_type === 'percent') {
      globalTax = (afterAllDiscount * (Number(global.tax_value) || 0)) / 100;
    } else {
      globalTax = Number(global.tax_value) || 0;
    }
  }

  const totalDiscount = lineDiscount + globalDiscount;
  const totalTax = lineTax + globalTax;
  const payable = subtotal - totalDiscount + totalTax;

  return {
    subtotal,
    line_discount: lineDiscount,
    line_tax: lineTax,
    global_discount: globalDiscount,
    global_tax: globalTax,
    total_discount: totalDiscount,
    total_tax: totalTax,
    payable,
  };
}

export function emptyLineItem(taxRate = 0): InvoiceLineItem {
  return {
    key: Math.random().toString(36).slice(2),
    product_id: null,
    sku: '',
    name: '',
    unit: 'عدد',
    quantity: 1,
    unit_price: 0,
    discount_type: 'percent',
    discount_value: 0,
    tax_rate: taxRate,
  };
}

export function generateInvoiceNumber(count: number): string {
  const num = 1000 + count + 1;
  return String(num);
}
