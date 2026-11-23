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

export const ALL_PAYMENTS = Object.keys(PAYMENT_LABELS) as Payment[];

export function isFree(payment: Payment): boolean {
  return payment === 'trade' || payment === 'gift';
}
