import type { AppState, Cart, Category, Item, TallyEvent } from '../types';
import { UNCATEGORIZED } from './reducer';

export function getCurrentEvent(state: AppState): TallyEvent {
  return state.events.find((event) => event.id === state.currentEventId) ?? state.events[0];
}

export function getActiveCart(state: AppState): Cart {
  return state.carts.find((cart) => cart.id === state.activeCartId) ?? state.carts[0];
}

/** Units sitting in open orders, per item. They are not sold yet but are spoken for. */
export function getReserved(state: AppState): Map<string, number> {
  const reserved = new Map<string, number>();
  for (const cart of state.carts) {
    for (const line of cart.lines) {
      reserved.set(line.itemId, (reserved.get(line.itemId) ?? 0) + line.qty);
    }
  }
  return reserved;
}

/** Units sold per item in one event, counting trades and gifts. */
export function getSoldByItem(state: AppState, eventId: string): Map<string, number> {
  const sold = new Map<string, number>();
  for (const sale of state.sales) {
    if (sale.eventId !== eventId) continue;
    for (const line of sale.lines) {
      sold.set(line.itemId, (sold.get(line.itemId) ?? 0) + line.qty);
    }
  }
  return sold;
}

export function countUnits(cart: Cart): number {
  return cart.lines.reduce((total, line) => total + line.qty, 0);
}

/** Low means "worth a glance at the display": 2 or fewer left. */
export function stockLevel(left: number): 'out' | 'low' | 'ok' {
  if (left <= 0) return 'out';
  return left <= 2 ? 'low' : 'ok';
}

export function itemsInCategory(items: Item[], categoryId: string): Item[] {
  return items.filter((item) => item.categoryId === categoryId);
}

export interface ItemSection {
  category: Category;
  items: Item[];
}

/** Stand-in category for items that aren't in one. Never saved. */
export const UNCATEGORIZED_SECTION: Category = {
  id: UNCATEGORIZED,
  name: 'Uncategorized',
  color: '#858b8d',
};

/**
 * Every category with its items, in order, plus an Uncategorized group at the
 * end when any item has no category. Sell and Table both draw from this.
 */
export function getSections(state: Pick<AppState, 'categories' | 'items'>): ItemSection[] {
  const sections = state.categories.map((category) => ({
    category,
    items: itemsInCategory(state.items, category.id),
  }));
  const loose = itemsInCategory(state.items, UNCATEGORIZED);
  return loose.length > 0
    ? [...sections, { category: UNCATEGORIZED_SECTION, items: loose }]
    : sections;
}
