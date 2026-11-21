import type { Payment } from '../types';

export const PAYMENT_LABELS: Record<Payment, string> = {
  cash: 'Cash',
  venmo: 'Venmo',
  zelle: 'Zelle',
  card: 'Card',
  other: 'Other',
  trade: 'Trade',
  gift: 'Freebie',
};

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(at: number): string {
  return new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Trades and gifts move stock but bring in no money. */
export function isFree(payment: Payment): boolean {
  return payment === 'trade' || payment === 'gift';
}
