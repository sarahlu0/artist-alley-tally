import type { Cents } from '../types';

export const DEFAULT_CURRENCY = '$';

// The symbol is a display setting that almost every screen reads. Keeping it
// here, set once per render by the store, saves threading it through every
// component. It only changes the label; amounts are never converted.
let currencySymbol = DEFAULT_CURRENCY;

export function setCurrencySymbol(symbol: string): void {
  currencySymbol = symbol || DEFAULT_CURRENCY;
}

export function getCurrencySymbol(): string {
  return currencySymbol;
}

/** $12 for whole amounts, $12.50 otherwise. */
export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  const amount = rest === 0 ? whole : `${whole}.${String(rest).padStart(2, '0')}`;
  return `${sign}${currencySymbol}${amount}`;
}

/** Reads what someone typed into a price box. Returns null if it isn't a price. */
export function parseMoney(text: string): Cents | null {
  // Drop a leading currency symbol (like $, € or CA$), spaces and thousands commas.
  // Anything else that isn't a plain number, such as "3 for 10" or "-5", is rejected.
  const cleaned = text
    .trim()
    .replace(/^[^\d.\-]+/, '')
    .replace(/[,\s]/g, '');
  if (cleaned === '' || cleaned === '.' || !/^\d{0,7}\.?\d{0,2}$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Plain number for a price input: 1250 -> "12.50", 1200 -> "12". */
export function moneyInputValue(cents: Cents): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * Splits `total` across `weights` in whole cents that add up exactly, so item
 * and category figures always sum back to the money actually taken.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / weightSum);
  const shares = exact.map(Math.floor);
  let remainder = total - shares.reduce((a, b) => a + b, 0);
  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { index } of byFraction) {
    if (remainder <= 0) break;
    shares[index] += 1;
    remainder -= 1;
  }
  return shares;
}
