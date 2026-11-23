import type { Cents } from '../types';

export const DEFAULT_CURRENCY = '$';

// Module state rather than context: nearly every component formats money, and
// the store sets this during render before any child reads it.
let currencySymbol = DEFAULT_CURRENCY;

export function setCurrencySymbol(symbol: string): void {
  currencySymbol = symbol || DEFAULT_CURRENCY;
}

export function getCurrencySymbol(): string {
  return currencySymbol;
}

/** Drops the cents when they are zero: $12, $12.50. */
export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  const amount = rest === 0 ? whole : `${whole}.${String(rest).padStart(2, '0')}`;
  return `${sign}${currencySymbol}${amount}`;
}

export function parseMoney(text: string): Cents | null {
  // Strips a leading currency symbol, spaces and thousands separators. Anything
  // else that isn't a plain non-negative number ("3 for 10", "-5") is rejected.
  const cleaned = text
    .trim()
    .replace(/^[^\d.\-]+/, '')
    .replace(/[,\s]/g, '');
  if (cleaned === '' || cleaned === '.' || !/^\d{0,7}\.?\d{0,2}$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** 1250 -> "12.50", 1200 -> "12". */
export function moneyInputValue(cents: Cents): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * Splits `total` in proportion to `weights` using largest-remainder rounding,
 * so the shares are whole cents that sum exactly to `total`.
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
