/**
 * FooladERP - Shared Utilities
 * Package: @foolad/shared
 */

export function normalizeMobileNumber(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('0098')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('98')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return `+98${cleaned}`;
}

export function formatRials(amount?: number | string | null): string {
  if (amount === undefined || amount === null || amount === '') {
    return '۰ ریال';
  }
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) {
    return '۰ ریال';
  }
  return `${num.toLocaleString('fa-IR')} ریال`;
}

export function formatTonnage(kg?: number | string | null): string {
  if (kg === undefined || kg === null || kg === '') {
    return '۰ تن';
  }
  const num = typeof kg === 'number' ? kg : Number(kg);
  if (isNaN(num)) {
    return '۰ تن';
  }
  const tons = num / 1000;
  return `${tons.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} تن`;
}
