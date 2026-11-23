/** Money is always integer cents, so sums never pick up float rounding. */
export type Cents = number;

export interface Category {
  id: string;
  name: string;
  /** Lowercase `#rrggbb`. */
  color: string;
}

/** `Item.categoryId` for items that aren't in a category. */
export const UNCATEGORIZED = '';

export interface Item {
  id: string;
  name: string;
  /** A category id, or UNCATEGORIZED. */
  categoryId: string;
  price: Cents;
  /** Negative when more were sold than were counted. */
  stock: number;
}

/**
 * mix:  any `quantity` matching units for `price`
 * set:  one of each of `itemIds` for `price`
 * bogo: `quantity` matching units, plus the cheapest extra one free
 */
export type DealKind = 'mix' | 'set' | 'bogo';

export interface Deal {
  id: string;
  name: string;
  enabled: boolean;
  kind: DealKind;
  /** Which units match. `itemIds` takes precedence; if both are empty, every unit matches. */
  categoryIds: string[];
  itemIds: string[];
  quantity: number;
  price: Cents;
}

export const MONEY_METHODS = ['cash', 'venmo', 'zelle', 'card', 'other'] as const;
export type MoneyMethod = (typeof MONEY_METHODS)[number];
/** `trade` and `gift` move stock but record no money. */
export type Payment = MoneyMethod | 'trade' | 'gift';

export interface CartLine {
  itemId: string;
  qty: number;
}

/** An open order. Several can be open at once; the rest are on hold. */
export interface Cart {
  id: string;
  label: string;
  lines: CartLine[];
  /** A total typed by hand, overriding the priced total. */
  customTotal: Cents | null;
}

export interface SaleLine {
  itemId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  qty: number;
  unitPrice: Cents;
  /** Line total after deal savings were allocated to it. */
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
  /** The total was typed by hand and differs from the priced total. */
  adjusted: boolean;
}

export interface TallyEvent {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  /** Cash in the box before the first sale. */
  cashFloat: Cents;
  /** Stock per item id when the event ended; null while it is running. */
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
  /** Display-only prefix for amounts. Nothing is converted. */
  currency: string;
}

/** Data URLs keyed by item id, stored separately from AppState. */
export type Photos = Record<string, string>;
