import { priceCart } from '../lib/deals';
import { DEFAULT_CURRENCY } from '../lib/money';
import { isFree } from '../lib/payments';
import type {
  AppState,
  Cart,
  Category,
  Cents,
  Deal,
  Item,
  Payment,
  Sale,
  SaleLine,
  TallyEvent,
} from '../types';

// Ids and timestamps always arrive inside the action, which keeps the reducer
// pure and makes every change easy to replay in a test.
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

/** Category id for items that aren't in any category. */
export const UNCATEGORIZED = '';

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
  const others = cart.lines.filter((line) => line.itemId !== itemId);
  const exists = others.length !== cart.lines.length;
  if (qty <= 0) return { ...cart, lines: others, customTotal: null };
  const lines = exists
    ? cart.lines.map((line) => (line.itemId === itemId ? { ...line, qty } : line))
    : [...cart.lines, { itemId, qty }];
  // A hand-typed total no longer makes sense once the items change.
  return { ...cart, lines, customTotal: null };
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
    // Always land on a fresh order so the next customer never ends up on a held one.
    carts: [...state.carts.filter((c) => c.id !== cart.id), emptyCart(action.newCartId)],
    activeCartId: action.newCartId,
  };
}

/**
 * Adds (+1) or takes away (-1) a sale's items: on the table if the sale belongs
 * to the current event, and in the event's frozen count if it has finished.
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

/** Removing a sale puts its items back. */
function deleteSale(state: AppState, id: string): AppState {
  const sale = state.sales.find((s) => s.id === id);
  if (!sale) return state;
  return moveSaleStock({ ...state, sales: state.sales.filter((s) => s.id !== id) }, sale, 1);
}

/** Undo for a deleted sale: the exact reverse of deleteSale. */
function restoreSale(state: AppState, sale: Sale): AppState {
  if (state.sales.some((s) => s.id === sale.id)) return state;
  const sales = [...state.sales, sale].sort((a, b) => b.at - a.at);
  return moveSaleStock({ ...state, sales }, sale, -1);
}

/**
 * Drops deals that lost everything they applied to. A deal with no categories
 * and no items left would otherwise start counting every item on the table.
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

/** Moves one item to where another one is, keeping everything else in order. */
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

/** Undo: takes a sale back and reopens it as the current order so it can be fixed. */
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
  const keep = restored.carts.filter((c) => c.id !== restored.activeCartId || c.lines.length > 0);
  return { ...restored, carts: [...keep, cart], activeCartId: cart.id };
}

function setPayment(sale: Sale, payment: Payment): Sale {
  if (isFree(payment)) return { ...sale, payment, total: 0, adjusted: false };
  if (!isFree(sale.payment)) return { ...sale, payment };
  // Coming back from a trade or gift: charge the normal price again.
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
      // Keep the items, but without a category.
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
      if (!state.carts.some((cart) => cart.id === action.id)) return state;
      // Drop the order being left if nothing was added to it.
      const carts = state.carts.filter(
        (cart) => cart.id === action.id || cart.id !== state.activeCartId || cart.lines.length > 0,
      );
      return { ...state, carts, activeCartId: action.id };
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

    case 'event/finish': {
      const leftover = Object.fromEntries(state.items.map((item) => [item.id, item.stock]));
      return updateCurrentEvent(state, (event) =>
        event.endedAt === null ? { ...event, endedAt: action.at, leftover } : event,
      );
    }

    case 'event/reopen':
      return updateCurrentEvent(state, (event) => ({ ...event, endedAt: null, leftover: null }));

    case 'event/start': {
      // Freeze the outgoing event first so its recap survives the restock below.
      const leftover = Object.fromEntries(state.items.map((item) => [item.id, item.stock]));
      const closed = updateCurrentEvent(state, (event) =>
        event.endedAt === null ? { ...event, endedAt: action.at, leftover } : event,
      );
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
