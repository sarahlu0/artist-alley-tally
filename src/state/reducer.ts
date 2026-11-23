import { priceCart } from '../lib/deals';
import { DEFAULT_CURRENCY } from '../lib/money';
import { isFree } from '../lib/payments';
import type {
  AppState,
  Cart,
  CartLine,
  Category,
  Cents,
  Deal,
  Item,
  Payment,
  Sale,
  SaleLine,
  TallyEvent,
} from '../types';
import { UNCATEGORIZED } from '../types';

// Ids and timestamps are passed in on the action so the reducer stays pure and replayable.
export type Action =
  | { type: 'state/replace'; state: AppState }
  | { type: 'welcome/done' }
  | { type: 'backup/done'; at: number }
  | { type: 'settings/currency'; symbol: string }
  | { type: 'catalog/set'; categories: Category[]; items: Item[]; deals?: Deal[] }
  | { type: 'item/save'; item: Item }
  | { type: 'item/delete'; id: string }
  | { type: 'item/reorder'; activeId: string; overId: string }
  | { type: 'item/shift'; id: string; direction: -1 | 1 }
  | { type: 'category/save'; category: Category }
  | { type: 'category/delete'; id: string; deleteItems: boolean }
  | { type: 'deal/save'; deal: Deal }
  | { type: 'deal/delete'; id: string }
  | { type: 'cart/add'; itemId: string }
  | { type: 'cart/setQty'; itemId: string; qty: number }
  | { type: 'cart/clear' }
  | { type: 'cart/hold'; newCartId: string }
  | { type: 'cart/switch'; id: string }
  | { type: 'cart/rename'; label: string }
  | { type: 'cart/setCustomTotal'; total: Cents | null }
  | { type: 'sale/complete'; saleId: string; payment: Payment; at: number; newCartId: string }
  | { type: 'sale/delete'; id: string }
  | { type: 'sale/restore'; sale: Sale }
  | { type: 'sale/reopen'; id: string; cartId: string }
  | { type: 'sale/setPayment'; id: string; payment: Payment }
  | { type: 'event/update'; id: string; name: string; cashFloat: Cents }
  | { type: 'event/finish'; at: number }
  | { type: 'event/reopen' }
  | { type: 'event/start'; id: string; name: string; at: number; stock: Record<string, number> };

function emptyCart(id: string): Cart {
  return { id, label: '', lines: [], customTotal: null };
}

export function createInitialState(eventId: string, cartId: string, now: number): AppState {
  return {
    version: 1,
    categories: [],
    items: [],
    deals: [],
    events: [
      {
        id: eventId,
        name: 'My first event',
        startedAt: now,
        endedAt: null,
        cashFloat: 0,
        leftover: null,
      },
    ],
    currentEventId: eventId,
    sales: [],
    carts: [emptyCart(cartId)],
    activeCartId: cartId,
    welcomed: false,
    lastBackupAt: null,
    currency: DEFAULT_CURRENCY,
  };
}

/** Replaces the entry with the same id, or adds it to the end. */
function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
  return list.some((existing) => existing.id === entry.id)
    ? list.map((existing) => (existing.id === entry.id ? entry : existing))
    : [...list, entry];
}

function updateActiveCart(state: AppState, change: (cart: Cart) => Cart): AppState {
  return {
    ...state,
    carts: state.carts.map((cart) => (cart.id === state.activeCartId ? change(cart) : cart)),
  };
}

function setQty(cart: Cart, itemId: string, qty: number): Cart {
  const exists = cart.lines.some((line) => line.itemId === itemId);
  let lines: CartLine[];
  if (qty <= 0) lines = cart.lines.filter((line) => line.itemId !== itemId);
  else if (exists)
    lines = cart.lines.map((line) => (line.itemId === itemId ? { ...line, qty } : line));
  else lines = [...cart.lines, { itemId, qty }];
  // A hand-typed total no longer applies once the items change.
  return { ...cart, lines, customTotal: null };
}

/** The carts minus the active one, if it is empty. Used when leaving the active cart. */
function dropActiveCartIfEmpty(state: AppState): Cart[] {
  return state.carts.filter((cart) => cart.id !== state.activeCartId || cart.lines.length > 0);
}

function currentEvent(state: AppState): TallyEvent | undefined {
  return state.events.find((event) => event.id === state.currentEventId);
}

function updateCurrentEvent(state: AppState, change: (event: TallyEvent) => TallyEvent): AppState {
  return {
    ...state,
    events: state.events.map((event) =>
      event.id === state.currentEventId ? change(event) : event,
    ),
  };
}

/** Ends the current event and snapshots stock as its leftover. No-op if it already ended. */
function endCurrentEvent(state: AppState, at: number): AppState {
  const leftover = Object.fromEntries(state.items.map((item) => [item.id, item.stock]));
  return updateCurrentEvent(state, (event) =>
    event.endedAt === null ? { ...event, endedAt: at, leftover } : event,
  );
}

function completeSale(
  state: AppState,
  action: Extract<Action, { type: 'sale/complete' }>,
): AppState {
  const event = currentEvent(state);
  const cart = state.carts.find((c) => c.id === state.activeCartId);
  if (!event || event.endedAt !== null || !cart) return state;

  const itemsById = new Map(state.items.map((item) => [item.id, item]));
  const categoryNames = new Map(state.categories.map((c) => [c.id, c.name]));
  const pricing = priceCart(cart.lines, state.items, state.deals);
  const lines: SaleLine[] = cart.lines.flatMap((line) => {
    const item = itemsById.get(line.itemId);
    if (!item) return [];
    return {
      itemId: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: categoryNames.get(item.categoryId) ?? '',
      qty: line.qty,
      unitPrice: item.price,
      paid: item.price * line.qty - (pricing.savingsByItem.get(item.id) ?? 0),
    };
  });
  if (lines.length === 0) return state;

  const free = isFree(action.payment);
  const adjusted = !free && cart.customTotal !== null && cart.customTotal !== pricing.total;
  const sale: Sale = {
    id: action.saleId,
    eventId: event.id,
    at: action.at,
    lines,
    deals: free ? [] : pricing.applied,
    subtotal: pricing.subtotal,
    total: free ? 0 : (cart.customTotal ?? pricing.total),
    payment: action.payment,
    adjusted,
  };

  const soldQty = new Map(lines.map((line) => [line.itemId, line.qty]));
  return {
    ...state,
    items: state.items.map((item) =>
      soldQty.has(item.id) ? { ...item, stock: item.stock - soldQty.get(item.id)! } : item,
    ),
    sales: [sale, ...state.sales],
    // Start a fresh cart rather than switching to a held one.
    carts: [...state.carts.filter((c) => c.id !== cart.id), emptyCart(action.newCartId)],
    activeCartId: action.newCartId,
  };
}

/**
 * Adds (sign 1) or removes (sign -1) a sale's quantities: in live stock if the
 * sale is from the current event, and in its event's leftover if that event ended.
 */
function moveSaleStock(state: AppState, sale: Sale, sign: 1 | -1): AppState {
  const qty = new Map(sale.lines.map((line) => [line.itemId, line.qty]));
  const adjust = (itemId: string, count: number) => count + sign * (qty.get(itemId) ?? 0);
  return {
    ...state,
    events: state.events.map((event) => {
      if (event.id !== sale.eventId || !event.leftover) return event;
      const entries = Object.entries(event.leftover);
      return {
        ...event,
        leftover: Object.fromEntries(entries.map(([itemId, n]) => [itemId, adjust(itemId, n)])),
      };
    }),
    items:
      sale.eventId === state.currentEventId
        ? state.items.map((item) => ({ ...item, stock: adjust(item.id, item.stock) }))
        : state.items,
  };
}

function deleteSale(state: AppState, id: string): AppState {
  const sale = state.sales.find((s) => s.id === id);
  if (!sale) return state;
  return moveSaleStock({ ...state, sales: state.sales.filter((s) => s.id !== id) }, sale, 1);
}

/** The inverse of deleteSale. */
function restoreSale(state: AppState, sale: Sale): AppState {
  if (state.sales.some((s) => s.id === sale.id)) return state;
  const sales = [...state.sales, sale].sort((a, b) => b.at - a.at);
  return moveSaleStock({ ...state, sales }, sale, -1);
}

/**
 * Removes deleted ids from deals, and drops deals left with nothing to match.
 * Without this, a deal whose scope empties out would start matching every unit.
 */
function pruneDeals(deals: Deal[], removedCategories: string[], removedItems: string[]): Deal[] {
  return deals.flatMap((deal) => {
    const categoryIds = deal.categoryIds.filter((id) => !removedCategories.includes(id));
    const itemIds = deal.itemIds.filter((id) => !removedItems.includes(id));
    const hadScope = deal.categoryIds.length + deal.itemIds.length > 0;
    const lostScope = hadScope && categoryIds.length + itemIds.length === 0;
    const brokenSet = deal.kind === 'set' && itemIds.length < 2;
    return lostScope || brokenSet ? [] : [{ ...deal, categoryIds, itemIds }];
  });
}

/** Deals that would disappear if these categories or items were deleted. */
export function dealsLostBy(
  deals: Deal[],
  removedCategories: string[],
  removedItems: string[],
): Deal[] {
  const kept = new Set(pruneDeals(deals, removedCategories, removedItems).map((d) => d.id));
  return deals.filter((deal) => !kept.has(deal.id));
}

function removeItems(state: AppState, ids: string[], removedCategories: string[] = []): AppState {
  const gone = new Set(ids);
  return {
    ...state,
    items: state.items.filter((item) => !gone.has(item.id)),
    deals: pruneDeals(state.deals, removedCategories, ids),
    carts: state.carts.map((cart) => ({
      ...cart,
      lines: cart.lines.filter((line) => !gone.has(line.itemId)),
    })),
  };
}

/** Moves `activeId` to the index of `overId`. */
function reorderItems(items: Item[], activeId: string, overId: string): Item[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from === -1 || to === -1 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Swaps an item with its neighbor in the same category. */
function shiftItem(items: Item[], id: string, direction: -1 | 1): Item[] {
  const item = items.find((entry) => entry.id === id);
  if (!item) return items;
  const sameCategory = items.filter((entry) => entry.categoryId === item.categoryId);
  const neighbor = sameCategory[sameCategory.indexOf(item) + direction];
  return neighbor ? reorderItems(items, id, neighbor.id) : items;
}

/** Deletes a sale and loads its items into a new active cart, for editing or undo. */
function reopenSale(state: AppState, id: string, cartId: string): AppState {
  const sale = state.sales.find((s) => s.id === id);
  if (!sale) return state;
  const restored = deleteSale(state, id);
  const stillExists = new Set(restored.items.map((item) => item.id));
  const cart: Cart = {
    ...emptyCart(cartId),
    lines: sale.lines
      .filter((line) => stillExists.has(line.itemId))
      .map((line) => ({ itemId: line.itemId, qty: line.qty })),
  };
  return { ...restored, carts: [...dropActiveCartIfEmpty(restored), cart], activeCartId: cart.id };
}

function setPayment(sale: Sale, payment: Payment): Sale {
  if (isFree(payment)) return { ...sale, payment, total: 0, adjusted: false };
  if (!isFree(sale.payment)) return { ...sale, payment };
  // Switching from a trade or gift back to money: restore the priced total.
  const savings = sale.deals.reduce((total, deal) => total + deal.savings, 0);
  return { ...sale, payment, total: sale.subtotal - savings };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'state/replace':
      return action.state;

    case 'welcome/done':
      return { ...state, welcomed: true };

    case 'backup/done':
      return { ...state, lastBackupAt: action.at };

    case 'settings/currency':
      return { ...state, currency: action.symbol.trim().slice(0, 4) || DEFAULT_CURRENCY };

    case 'catalog/set':
      return {
        ...state,
        categories: action.categories,
        items: action.items,
        deals: action.deals ?? state.deals,
      };

    case 'item/save':
      return { ...state, items: upsert(state.items, action.item) };

    case 'item/delete':
      return removeItems(state, [action.id]);

    case 'item/reorder':
      return { ...state, items: reorderItems(state.items, action.activeId, action.overId) };

    case 'item/shift':
      return { ...state, items: shiftItem(state.items, action.id, action.direction) };

    case 'category/save':
      return { ...state, categories: upsert(state.categories, action.category) };

    case 'category/delete': {
      const inCategory = state.items.filter((item) => item.categoryId === action.id);
      const categories = state.categories.filter((category) => category.id !== action.id);
      if (action.deleteItems) {
        const ids = inCategory.map((item) => item.id);
        return { ...removeItems(state, ids, [action.id]), categories };
      }
      return {
        ...state,
        categories,
        items: state.items.map((item) =>
          item.categoryId === action.id ? { ...item, categoryId: UNCATEGORIZED } : item,
        ),
        deals: pruneDeals(state.deals, [action.id], []),
      };
    }

    case 'deal/save':
      return { ...state, deals: upsert(state.deals, action.deal) };

    case 'deal/delete':
      return { ...state, deals: state.deals.filter((deal) => deal.id !== action.id) };

    case 'cart/add':
      return updateActiveCart(state, (cart) => {
        const current = cart.lines.find((line) => line.itemId === action.itemId)?.qty ?? 0;
        return setQty(cart, action.itemId, current + 1);
      });

    case 'cart/setQty':
      return updateActiveCart(state, (cart) => setQty(cart, action.itemId, action.qty));

    case 'cart/clear':
      return updateActiveCart(state, (cart) => emptyCart(cart.id));

    case 'cart/hold': {
      const active = state.carts.find((cart) => cart.id === state.activeCartId);
      if (!active || active.lines.length === 0) return state;
      return {
        ...state,
        carts: [...state.carts, emptyCart(action.newCartId)],
        activeCartId: action.newCartId,
      };
    }

    case 'cart/switch': {
      const exists = state.carts.some((cart) => cart.id === action.id);
      if (!exists || action.id === state.activeCartId) return state;
      return { ...state, carts: dropActiveCartIfEmpty(state), activeCartId: action.id };
    }

    case 'cart/rename':
      return updateActiveCart(state, (cart) => ({ ...cart, label: action.label }));

    case 'cart/setCustomTotal':
      return updateActiveCart(state, (cart) => ({ ...cart, customTotal: action.total }));

    case 'sale/complete':
      return completeSale(state, action);

    case 'sale/delete':
      return deleteSale(state, action.id);

    case 'sale/restore':
      return restoreSale(state, action.sale);

    case 'sale/reopen':
      return reopenSale(state, action.id, action.cartId);

    case 'sale/setPayment':
      return {
        ...state,
        sales: state.sales.map((sale) =>
          sale.id === action.id ? setPayment(sale, action.payment) : sale,
        ),
      };

    case 'event/update':
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.id
            ? { ...event, name: action.name, cashFloat: action.cashFloat }
            : event,
        ),
      };

    case 'event/finish':
      return endCurrentEvent(state, action.at);

    case 'event/reopen':
      return updateCurrentEvent(state, (event) => ({ ...event, endedAt: null, leftover: null }));

    case 'event/start': {
      // End the outgoing event first so its leftover snapshot is taken before the restock.
      const closed = endCurrentEvent(state, action.at);
      const next: TallyEvent = {
        id: action.id,
        name: action.name,
        startedAt: action.at,
        endedAt: null,
        cashFloat: 0,
        leftover: null,
      };
      return {
        ...closed,
        events: [...closed.events, next],
        currentEventId: next.id,
        items: closed.items.map((item) =>
          item.id in action.stock ? { ...item, stock: action.stock[item.id] } : item,
        ),
      };
    }
  }
}
