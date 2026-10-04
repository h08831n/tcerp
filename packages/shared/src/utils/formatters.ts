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

export function formatRials(amount: number): string {
  return `${amount.toLocaleString('fa-IR')} ریال`;
}

export function formatTonnage(kg: number): string {
  const tons = kg / 1000;
  return `${tons.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} تن`;
}
