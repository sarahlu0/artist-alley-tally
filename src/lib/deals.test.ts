import { describe, expect, it } from 'vitest';
import type { Deal, Item } from '../types';
import { priceCart } from './deals';

const item = (id: string, categoryId: string, price: number): Item => ({
  id,
  name: id,
  categoryId,
  price,
  stock: 10,
});
const items = [item('a', 'stickers', 400), item('b', 'stickers', 400), item('big', 'prints', 2000)];

const deal = (overrides: Partial<Deal>): Deal => ({
  id: 'deal',
  name: 'Deal',
  enabled: true,
  kind: 'mix',
  categoryIds: [],
  itemIds: [],
  quantity: 3,
  price: 1000,
  ...overrides,
});

describe('priceCart', () => {
  it('repeats a mix deal and charges full price for leftovers', () => {
    const lines = [{ itemId: 'a', qty: 7 }];
    const pricing = priceCart(lines, items, [deal({ categoryIds: ['stickers'] })]);
    expect(pricing.total).toBe(1000 + 1000 + 400);
    expect(pricing.applied[0]).toMatchObject({ times: 2, savings: 400 });
  });

  it('ignores items outside the deal', () => {
    const lines = [
      { itemId: 'a', qty: 2 },
      { itemId: 'big', qty: 1 },
    ];
    const pricing = priceCart(lines, items, [deal({ categoryIds: ['stickers'] })]);
    expect(pricing.total).toBe(2800);
    expect(pricing.nudges).toEqual(['1 more for Deal']);
  });

  it('never makes an order cost more', () => {
    const pricey = deal({ categoryIds: ['stickers'], quantity: 2, price: 5000 });
    expect(priceCart([{ itemId: 'a', qty: 2 }], items, [pricey]).total).toBe(800);
  });

  it('prices a specific pair as a set', () => {
    const pair = deal({ kind: 'set', itemIds: ['a', 'big'], price: 2200 });
    const lines = [
      { itemId: 'a', qty: 1 },
      { itemId: 'b', qty: 1 },
      { itemId: 'big', qty: 1 },
    ];
    expect(priceCart(lines, items, [pair]).total).toBe(2200 + 400);
  });

  it('gives the cheapest one free on buy-some-get-one', () => {
    const bogo = deal({ kind: 'bogo', quantity: 2 });
    const lines = [
      { itemId: 'a', qty: 2 },
      { itemId: 'big', qty: 1 },
    ];
    const pricing = priceCart(lines, items, [bogo]);
    expect(pricing.savings).toBe(400);
  });

  it('skips deals that are switched off', () => {
    const off = deal({ categoryIds: ['stickers'], enabled: false });
    expect(priceCart([{ itemId: 'a', qty: 3 }], items, [off]).total).toBe(1200);
  });
});
