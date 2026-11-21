/** All money is stored as whole cents so totals never drift from rounding. */
export type Cents = number;

export interface Category {
  id: string;
  name: string;
  /** "#rrggbb". */
  color: string;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  price: Cents;
  /** Units left. Can dip below zero if more were sold than counted. */
  stock: number;
}

/**
 * mix  – any `quantity` matching items for `price` ("3 stickers for $10")
 * set  – one of each item in `itemIds` together for `price`
 * bogo – buy `quantity` matching items, get the cheapest extra one free
 */
export type DealKind = 'mix' | 'set' | 'bogo';

export interface Deal {
  id: string;
  name: string;
  enabled: boolean;
  kind: DealKind;
  /** Which items count. `itemIds` wins; if both are empty, everything counts. */
  categoryIds: string[];
  itemIds: string[];
  quantity: number;
  price: Cents;
}

export const MONEY_METHODS = ['cash', 'venmo', 'zelle', 'card', 'other'] as const;
export type MoneyMethod = (typeof MONEY_METHODS)[number];
/** Trades and gifts take stock off the table without bringing money in. */
export type Payment = MoneyMethod | 'trade' | 'gift';

export interface CartLine {
  itemId: string;
  qty: number;
}

/** An order that is still open. Several can be open at once. */
export interface Cart {
  id: string;
  label: string;
  lines: CartLine[];
  /** Set when the artist agreed a different total than the app worked out. */
  customTotal: Cents | null;
}

export interface SaleLine {
  itemId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  qty: number;
  unitPrice: Cents;
  /** What this line came to once deals were taken off. */
  paid: Cents;
}

export interface AppliedDeal {
  dealId: string;
  name: string;
  times: number;
  savings: Cents;
}

export interface Sale {
  id: string;
  eventId: string;
  at: number;
  lines: SaleLine[];
  deals: AppliedDeal[];
  subtotal: Cents;
  total: Cents;
  payment: Payment;
  /** True when the total was typed in by hand. */
  adjusted: boolean;
}

export interface TallyEvent {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  /** Change in the cash box before the first sale. */
  cashFloat: Cents;
  /** Stock left per item when the event was finished. */
  leftover: Record<string, number> | null;
}

export interface AppState {
  version: 1;
  categories: Category[];
  items: Item[];
  deals: Deal[];
  events: TallyEvent[];
  currentEventId: string;
  sales: Sale[];
  carts: Cart[];
  activeCartId: string;
  welcomed: boolean;
  lastBackupAt: number | null;
  /** Symbol shown before amounts, like $ or €. Only a label; nothing is converted. */
  currency: string;
}

/** Item photos as small data URLs, keyed by item id. Stored apart from AppState. */
export type Photos = Record<string, string>;
