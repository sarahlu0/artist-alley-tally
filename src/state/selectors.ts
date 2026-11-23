import {
  UNCATEGORIZED,
  type AppState,
  type Cart,
  type Category,
  type Item,
  type TallyEvent,
} from '../types';

export function getCurrentEvent(state: AppState): TallyEvent {
  return state.events.find((event) => event.id === state.currentEventId) ?? state.events[0];
}

export function getActiveCart(state: AppState): Cart {
  return state.carts.find((cart) => cart.id === state.activeCartId) ?? state.carts[0];
}

/** Units in open carts (active and held), per item id. */
export function getReserved(state: AppState): Map<string, number> {
  const reserved = new Map<string, number>();
  for (const cart of state.carts) {
    for (const line of cart.lines) {
      reserved.set(line.itemId, (reserved.get(line.itemId) ?? 0) + line.qty);
    }
  }
  return reserved;
}

/** Units that left in an event's sales, per item id, including trades and gifts. */
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

const LOW_STOCK = 2;

export function stockLevel(left: number): 'out' | 'low' | 'ok' {
  if (left <= 0) return 'out';
  return left <= LOW_STOCK ? 'low' : 'ok';
}

export function itemsInCategory(items: Item[], categoryId: string): Item[] {
  return items.filter((item) => item.categoryId === categoryId);
}

export interface ItemSection {
  category: Category;
  items: Item[];
}

/** Display-only category for uncategorized items. Never stored in state. */
export const UNCATEGORIZED_SECTION: Category = {
  id: UNCATEGORIZED,
  name: 'Uncategorized',
  color: '#858b8d',
};

/** Categories in order with their items, plus an Uncategorized section last if any item needs one. */
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

/** A React key for a section; the uncategorized id is an empty string. */
export function sectionKey(category: Category): string {
  return category.id === UNCATEGORIZED ? 'uncategorized' : category.id;
}
