import { describe, expect, it } from 'vitest';
import { summarizeEvent } from '../lib/stats';
import {
  UNCATEGORIZED,
  type AppState,
  type Category,
  type Deal,
  type Item,
  type Payment,
} from '../types';
import { createInitialState, reducer } from './reducer';

// The 15-order mock rush from the MVP test script, replayed against its answer
// key. P = print ($10), S = sticker ($4), C = charm ($12).
const STOCK: Record<string, number> = {
  P1: 6,
  P2: 5,
  P3: 6,
  P4: 2,
  P5: 5,
  S1: 10,
  S2: 10,
  S3: 8,
  S4: 8,
  S5: 10,
  S6: 8,
  C1: 5,
  C2: 4,
  C3: 4,
  C4: 5,
};
const PRICE: Record<string, number> = { P: 1000, S: 400, C: 1200 };

const categories: Category[] = ['P', 'S', 'C'].map((id) => ({ id, name: id, color: 'clay' }));
const items: Item[] = Object.entries(STOCK).map(([id, stock]) => ({
  id,
  name: id,
  categoryId: id[0],
  price: PRICE[id[0]],
  stock,
}));
const mix = (id: string, categoryId: string, quantity: number, price: number): Deal => ({
  id,
  name: id,
  enabled: true,
  kind: 'mix',
  categoryIds: [categoryId],
  itemIds: [],
  quantity,
  price,
});
const deals = [mix('prints', 'P', 2, 1800), mix('stickers', 'S', 3, 1000)];

const ORDERS: Array<[items: string, payment: Payment, total: number]> = [
  ['P1', 'cash', 10],
  ['C1 S1', 'venmo', 16],
  ['S2 S3 S5', 'zelle', 10],
  ['P2 P4 S4', 'venmo', 22],
  ['S6', 'cash', 4],
  ['P3 P5', 'card', 18],
  ['C2 C3', 'card', 24],
  ['S2 S2 S1', 'cash', 10],
  ['P4 P1', 'zelle', 18],
  ['S5 S5 C1', 'cash', 20],
  ['P3 C2', 'venmo', 22],
  ['P2 C1', 'card', 22],
  ['P1 P5 C4 S3 S4 S6', 'zelle', 40],
  ['S4 S1', 'cash', 8],
  ['C3 S6 S5', 'venmo', 20],
];

function setUp(): AppState {
  const start = createInitialState('event', 'cart-0', 0);
  return reducer(start, { type: 'catalog/set', categories, items, deals });
}

function sell(state: AppState, order: string, payment: Payment, n: number): AppState {
  for (const itemId of order.split(' ')) state = reducer(state, { type: 'cart/add', itemId });
  return reducer(state, {
    type: 'sale/complete',
    saleId: `sale-${n}`,
    payment,
    at: n,
    newCartId: `cart-${n + 1}`,
  });
}

function runRush(): AppState {
  return ORDERS.reduce((state, [order, payment], n) => sell(state, order, payment, n), setUp());
}

describe('mock rush', () => {
  const state = runRush();
  const recap = summarizeEvent(state, 'event')!;

  it('charges every order what the answer key says', () => {
    const totals = [...state.sales].reverse().map((sale) => sale.total / 100);
    expect(totals).toEqual(ORDERS.map(([, , total]) => total));
  });

  it('matches revenue and each payment method', () => {
    expect(recap.revenue).toBe(26400);
    expect(recap.orderCount).toBe(15);
    const byMethod = Object.fromEntries(recap.payments.map((p) => [p.method, p.total / 100]));
    expect(byMethod).toEqual({ cash: 52, venmo: 80, zelle: 68, card: 64, other: 0 });
  });

  it('ends with the right stock', () => {
    const left = Object.fromEntries(state.items.map((item) => [item.id, item.stock]));
    expect(left).toEqual({
      P1: 3,
      P2: 3,
      P3: 4,
      P4: 0,
      P5: 3,
      S1: 7,
      S2: 7,
      S3: 6,
      S4: 5,
      S5: 6,
      S6: 5,
      C1: 2,
      C2: 2,
      C3: 2,
      C4: 4,
    });
  });

  it('splits money across items without losing a cent', () => {
    const itemTotal = recap.items.reduce((total, row) => total + row.revenue, 0);
    expect(itemTotal).toBe(recap.revenue);
    expect(recap.items.find((row) => row.itemId === 'P4')).toMatchObject({
      brought: 2,
      sold: 2,
      left: 0,
      soldOutAt: 8,
    });
  });
});

describe('orders', () => {
  it('keeps a held order separate while another customer pays', () => {
    let state = setUp();
    state = reducer(state, { type: 'cart/add', itemId: 'P2' });
    state = reducer(state, { type: 'cart/hold', newCartId: 'quick' });
    state = sell(state, 'S6', 'cash', 1);
    expect(state.sales[0].total).toBe(400);
    expect(state.carts.find((cart) => cart.id === 'cart-0')?.lines).toEqual([
      { itemId: 'P2', qty: 1 },
    ]);
  });

  it('takes stock without money for a trade, and puts it back on undo', () => {
    let state = sell(setUp(), 'C4', 'trade', 1);
    expect(state.sales[0].total).toBe(0);
    expect(state.items.find((item) => item.id === 'C4')?.stock).toBe(4);
    expect(summarizeEvent(state, 'event')!.giveaways).toEqual({ orders: 1, units: 1, value: 1200 });

    state = reducer(state, { type: 'sale/delete', id: 'sale-1' });
    expect(state.items.find((item) => item.id === 'C4')?.stock).toBe(5);
  });

  it('records a hand-typed total, and forgets it if the items change', () => {
    let state = reducer(setUp(), { type: 'cart/add', itemId: 'C1' });
    state = reducer(state, { type: 'cart/setCustomTotal', total: 1000 });
    const haggled = reducer(state, {
      type: 'sale/complete',
      saleId: 'haggled',
      payment: 'cash',
      at: 1,
      newCartId: 'next',
    });
    expect(haggled.sales[0]).toMatchObject({ total: 1000, subtotal: 1200, adjusted: true });

    const changed = sell(state, 'C1', 'cash', 1);
    expect(changed.sales[0]).toMatchObject({ total: 2400, adjusted: false });
  });

  it('reopens a sale as the current order on undo', () => {
    let state = sell(setUp(), 'P1 P2', 'venmo', 1);
    state = reducer(state, { type: 'sale/reopen', id: 'sale-1', cartId: 'again' });
    expect(state.sales).toHaveLength(0);
    expect(state.activeCartId).toBe('again');
    expect(state.carts).toHaveLength(1);
    expect(state.items.find((item) => item.id === 'P1')?.stock).toBe(6);
  });

  it('gives stock back when a sale is deleted after finishing, even if the event reopens', () => {
    let state = sell(setUp(), 'P4 P4', 'cash', 1);
    state = reducer(state, { type: 'event/finish', at: 2 });
    state = reducer(state, { type: 'sale/delete', id: 'sale-1' });
    expect(state.events[0].leftover?.P4).toBe(2);
    state = reducer(state, { type: 'event/reopen' });
    expect(state.items.find((item) => item.id === 'P4')?.stock).toBe(2);
  });

  it('credits a deal to the items it covered', () => {
    const state = sell(setUp(), 'P1 P2 C1', 'cash', 1);
    expect(state.sales[0].lines.map((line) => line.paid)).toEqual([900, 900, 1200]);
  });

  it('keeps a finished event recap after restocking for the next one', () => {
    let state = runRush();
    state = reducer(state, {
      type: 'event/start',
      id: 'next',
      name: 'Next',
      at: 99,
      stock: { P4: 8 },
    });
    expect(state.items.find((item) => item.id === 'P4')?.stock).toBe(8);
    const old = summarizeEvent(state, 'event')!;
    expect(old.items.find((row) => row.itemId === 'P4')).toMatchObject({ brought: 2, left: 0 });
    expect(summarizeEvent(state, 'next')!.revenue).toBe(0);
  });
});

describe('categories', () => {
  it('deletes a category with its items, and drops deals that only covered it', () => {
    let state = reducer(setUp(), { type: 'cart/add', itemId: 'S1' });
    state = reducer(state, { type: 'category/delete', id: 'S', deleteItems: true });
    expect(state.items.some((item) => item.categoryId === 'S')).toBe(false);
    expect(state.carts.every((cart) => cart.lines.length === 0)).toBe(true);
    // "3 stickers for $10" would otherwise apply to everything left.
    expect(state.deals.map((deal) => deal.id)).toEqual(['prints']);
  });

  it('can keep the items as uncategorized instead', () => {
    const state = reducer(setUp(), { type: 'category/delete', id: 'S', deleteItems: false });
    const stickers = state.items.filter((item) => item.id.startsWith('S'));
    expect(stickers).toHaveLength(6);
    expect(stickers.every((item) => item.categoryId === UNCATEGORIZED)).toBe(true);
    expect(state.deals.map((deal) => deal.id)).toEqual(['prints']);
  });

  it('reorders items and moves one a step within its category', () => {
    let state = reducer(setUp(), { type: 'item/reorder', activeId: 'P5', overId: 'P1' });
    expect(state.items.slice(0, 2).map((item) => item.id)).toEqual(['P5', 'P1']);
    state = reducer(state, { type: 'item/shift', id: 'P5', direction: 1 });
    expect(state.items.slice(0, 2).map((item) => item.id)).toEqual(['P1', 'P5']);
    // Already last in its category: nothing happens.
    state = reducer(state, { type: 'item/shift', id: 'C4', direction: 1 });
    expect(state.items.at(-1)?.id).toBe('C4');
  });
});

describe('undo for a deleted order', () => {
  it('puts the order and the stock back exactly as they were', () => {
    const before = runRush();
    const sale = before.sales[5];
    const deleted = reducer(before, { type: 'sale/delete', id: sale.id });
    expect(deleted.sales).toHaveLength(14);
    const restored = reducer(deleted, { type: 'sale/restore', sale });
    expect(restored.sales).toEqual(before.sales);
    expect(restored.items).toEqual(before.items);
  });

  it('works for a finished event too', () => {
    const before = reducer(runRush(), { type: 'event/finish', at: 100 });
    const sale = before.sales[0];
    const restored = reducer(reducer(before, { type: 'sale/delete', id: sale.id }), {
      type: 'sale/restore',
      sale,
    });
    expect(restored.events).toEqual(before.events);
  });
});
