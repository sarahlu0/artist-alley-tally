import { allocate } from './money';
import {
  MONEY_METHODS,
  type AppState,
  type Cents,
  type MoneyMethod,
  type Sale,
  type TallyEvent,
} from '../types';
import { isFree } from './payments';

export interface ItemRecap {
  itemId: string;
  name: string;
  categoryName: string;
  /** Units sold for money. */
  sold: number;
  /** Units traded or given away. */
  given: number;
  /** After deals and hand-typed totals. */
  revenue: Cents;
  /** Null when the item was deleted, since its stock is no longer known. */
  brought: number | null;
  left: number | null;
  /** Time of the last sale, if the item ran out. */
  soldOutAt: number | null;
}

export interface PaymentRecap {
  method: MoneyMethod;
  count: number;
  total: Cents;
}

export interface EventRecap {
  event: TallyEvent;
  revenue: Cents;
  /** Excludes trades and gifts. */
  orderCount: number;
  unitsSold: number;
  payments: PaymentRecap[];
  /** Starting cash plus cash sales. */
  cashExpected: Cents;
  items: ItemRecap[];
  categories: Array<{ name: string; units: number; revenue: Cents }>;
  deals: Array<{ name: string; times: number; savings: Cents }>;
  giveaways: { orders: number; units: number; value: Cents };
  adjustedCount: number;
}

function stockLeft(state: AppState, event: TallyEvent): Map<string, number> {
  if (event.leftover) return new Map(Object.entries(event.leftover));
  if (event.id !== state.currentEventId) return new Map();
  return new Map(state.items.map((item) => [item.id, item.stock]));
}

export function summarizeEvent(state: AppState, eventId: string): EventRecap | null {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return null;

  const sales: Sale[] = state.sales.filter((sale) => sale.eventId === eventId);
  const paid = sales.filter((sale) => !isFree(sale.payment));
  const free = sales.filter((sale) => isFree(sale.payment));

  const left = stockLeft(state, event);
  const liveItems = new Map(state.items.map((item) => [item.id, item]));
  const categoryNames = new Map(state.categories.map((c) => [c.id, c.name]));

  const items = new Map<string, ItemRecap>();
  const rowFor = (itemId: string, name: string, categoryName: string): ItemRecap => {
    let row = items.get(itemId);
    if (!row) {
      row = {
        itemId,
        name,
        categoryName,
        sold: 0,
        given: 0,
        revenue: 0,
        brought: null,
        left: null,
        soldOutAt: null,
      };
      items.set(itemId, row);
    }
    return row;
  };

  // Seed rows from stock so items with no sales still get a row.
  for (const itemId of left.keys()) {
    const item = liveItems.get(itemId);
    if (item) rowFor(itemId, item.name, categoryNames.get(item.categoryId) ?? '');
  }

  const lastSoldAt = new Map<string, number>();
  for (const sale of sales) {
    // Line `paid` amounts already include deal savings. Allocating the sale total
    // over them also spreads a hand-typed total, and is 0 for trades and gifts.
    const shares = allocate(
      sale.total,
      sale.lines.map((line) => line.paid),
    );
    sale.lines.forEach((line, index) => {
      const row = rowFor(line.itemId, line.name, line.categoryName);
      if (isFree(sale.payment)) row.given += line.qty;
      else row.sold += line.qty;
      row.revenue += shares[index];
      lastSoldAt.set(line.itemId, Math.max(lastSoldAt.get(line.itemId) ?? 0, sale.at));
    });
  }

  for (const row of items.values()) {
    const remaining = left.get(row.itemId);
    if (remaining === undefined) continue;
    row.left = Math.max(0, remaining);
    row.brought = remaining + row.sold + row.given;
    if (remaining <= 0 && lastSoldAt.has(row.itemId)) row.soldOutAt = lastSoldAt.get(row.itemId)!;
  }

  const categories = new Map<string, { name: string; units: number; revenue: Cents }>();
  for (const row of items.values()) {
    const name = row.categoryName || 'Uncategorized';
    const entry = categories.get(name) ?? { name, units: 0, revenue: 0 };
    entry.units += row.sold;
    entry.revenue += row.revenue;
    categories.set(name, entry);
  }

  const deals = new Map<string, { name: string; times: number; savings: Cents }>();
  for (const sale of paid) {
    for (const deal of sale.deals) {
      const entry = deals.get(deal.dealId) ?? { name: deal.name, times: 0, savings: 0 };
      entry.times += deal.times;
      entry.savings += deal.savings;
      deals.set(deal.dealId, entry);
    }
  }

  const payments: PaymentRecap[] = MONEY_METHODS.map((method) => {
    const matching = paid.filter((sale) => sale.payment === method);
    return { method, count: matching.length, total: matching.reduce((t, s) => t + s.total, 0) };
  });

  const countUnits = (list: Sale[]) =>
    list.reduce((total, sale) => total + sale.lines.reduce((t, line) => t + line.qty, 0), 0);

  return {
    event,
    revenue: paid.reduce((total, sale) => total + sale.total, 0),
    orderCount: paid.length,
    unitsSold: countUnits(paid),
    payments,
    cashExpected: event.cashFloat + (payments.find((p) => p.method === 'cash')?.total ?? 0),
    items: [...items.values()].sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name)),
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
    deals: [...deals.values()].sort((a, b) => b.times - a.times),
    giveaways: {
      orders: free.length,
      units: countUnits(free),
      value: free.reduce((total, sale) => total + sale.subtotal, 0),
    },
    adjustedCount: paid.filter((sale) => sale.adjusted).length,
  };
}
