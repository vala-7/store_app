import { toPersianDigits } from './jalali';

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) return toPersianDigits('0');
  const fixed = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return toPersianDigits(fixed);
}

export function formatCurrency(value: number | null | undefined): string {
  const formatted = formatNumber(value, 0);
  return `${formatted} ریال`;
}

export function formatCurrencyShort(value: number | null | undefined): string {
  const v = Number(value) || 0;
  if (Math.abs(v) >= 1_000_000_000) {
    return `${formatNumber(v / 1_000_000_000, 1)} میلیارد`;
  }
  if (Math.abs(v) >= 1_000_000) {
    return `${formatNumber(v / 1_000_000, 0)} میلیون`;
  }
  return `${formatNumber(v, 0)} ریال`;
}

export function formatPercent(value: number | null | undefined): string {
  return `${formatNumber(value || 0, 0)}٪`;
}
