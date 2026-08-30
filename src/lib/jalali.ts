import * as jalaali from 'jalaali-js';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const PERSIAN_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function toPersianDigits(input: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[parseInt(d, 10)]);
}

function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export function toJalali(date: Date | string): JalaliDate {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { jy, jm, jd } = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { jy, jm, jd };
}

export function toGregorian(jy: number, jm: number, jd: number): Date {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

export function formatJalaliDate(date: Date | string): string {
  const { jy, jm, jd } = toJalali(date);
  return `${toPersianDigits(jy)}/${toPersianDigits(String(jm).padStart(2, '0'))}/${toPersianDigits(String(jd).padStart(2, '0'))}`;
}

export function formatJalaliDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { jy, jm, jd } = toJalali(d);
  const weekday = d.getDay();
  return `${PERSIAN_WEEKDAYS[weekday]} ${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

export function jalaliMonthName(jm: number): string {
  return PERSIAN_MONTHS[jm - 1] ?? '';
}

export function jalaliWeekdayName(day: number): string {
  return PERSIAN_WEEKDAYS[day] ?? '';
}

export function jalaliWeekdayShort(day: number): string {
  return PERSIAN_WEEKDAYS_SHORT[day] ?? '';
}

export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  return jalaali.isValidJalaaliDate(jy, jm, jd);
}

export function daysInJalaliMonth(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function todayJalali(): JalaliDate {
  return toJalali(new Date());
}

export function parseJalaliInput(text: string): JalaliDate | null {
  const clean = toEnglishDigits(text).replace(/[\/\-.]/g, '/').trim();
  const parts = clean.split('/');
  if (parts.length !== 3) return null;
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  if (!jy || !jm || !jd) return null;
  if (!isValidJalaliDate(jy, jm, jd)) return null;
  return { jy, jm, jd };
}

export { toPersianDigits, toEnglishDigits, PERSIAN_MONTHS, PERSIAN_WEEKDAYS };
