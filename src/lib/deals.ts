import type { AppliedDeal, Cart, CartLine, Cents, Deal, DealKind, Item } from '../types';
import { allocate } from './money';

export interface Pricing {
  subtotal: Cents;
  applied: AppliedDeal[];
  /** How much the deals took off each item, keyed by item id. */
  savingsByItem: Map<string, Cents>;
  savings: Cents;
  total: Cents;
  /** Short hints such as "1 more for 3 stickers for $10". */
  nudges: string[];
}

interface Unit {
  itemId: string;
  categoryId: string;
  price: Cents;
  used: boolean;
}

// Most specific deals claim their items first.
const KIND_ORDER: Record<DealKind, number> = { set: 0, mix: 1, bogo: 2 };

function matches(deal: Deal, unit: Unit): boolean {
  if (deal.itemIds.length > 0) return deal.itemIds.includes(unit.itemId);
  if (deal.categoryIds.length > 0) return deal.categoryIds.includes(unit.categoryId);
  return true;
}

/** Unclaimed units this deal could use, most expensive first. */
function available(deal: Deal, units: Unit[]): Unit[] {
  return units.filter((u) => !u.used && matches(deal, u)).sort((a, b) => b.price - a.price);
}

function sum(units: Unit[]): Cents {
  return units.reduce((total, u) => total + u.price, 0);
}

/** Picks the next group of units a deal applies to, or null when it no longer applies. */
function nextGroup(deal: Deal, units: Unit[]): { group: Unit[]; savings: Cents } | null {
  const pool = available(deal, units);

  if (deal.kind === 'set') {
    const group: Unit[] = [];
    for (const itemId of deal.itemIds) {
      const unit = pool.find((u) => u.itemId === itemId);
      if (!unit) return null;
      group.push(unit);
    }
    if (group.length < 2) return null;
    return { group, savings: sum(group) - deal.price };
  }

  if (deal.quantity < 1) return null;

  if (deal.kind === 'mix') {
    if (pool.length < deal.quantity) return null;
    const group = pool.slice(0, deal.quantity);
    return { group, savings: sum(group) - deal.price };
  }

  // bogo: pay for the priciest `quantity`, the cheapest remaining one is free.
  if (pool.length < deal.quantity + 1) return null;
  const free = pool[pool.length - 1];
  return { group: [...pool.slice(0, deal.quantity), free], savings: free.price };
}

function nudgeFor(deal: Deal, units: Unit[]): string | null {
  const left = available(deal, units);
  if (left.length === 0) return null;

  if (deal.kind === 'mix') {
    const missing = deal.quantity - left.length;
    return missing > 0 && missing <= 2 ? `${missing} more for ${deal.name}` : null;
  }
  if (deal.kind === 'bogo') {
    return left.length === deal.quantity ? `Next one is free: ${deal.name}` : null;
  }
  const have = new Set(left.map((u) => u.itemId));
  const missing = deal.itemIds.filter((id) => !have.has(id));
  return missing.length === 1 ? `1 more item for ${deal.name}` : null;
}

/**
 * Works out what an order costs. Every unit can count towards one deal only,
 * and a deal repeats for as long as there are enough items left for it.
 */
export function priceCart(lines: CartLine[], items: Item[], deals: Deal[]): Pricing {
  const byId = new Map(items.map((item) => [item.id, item]));
  const units: Unit[] = [];
  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item) continue;
    for (let i = 0; i < line.qty; i++) {
      units.push({ itemId: item.id, categoryId: item.categoryId, price: item.price, used: false });
    }
  }

  const subtotal = sum(units);
  const active = deals
    .filter((deal) => deal.enabled)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  const applied: AppliedDeal[] = [];
  const savingsByItem = new Map<string, Cents>();
  for (const deal of active) {
    let times = 0;
    let savings = 0;
    let next = nextGroup(deal, units);
    while (next && next.savings > 0) {
      const shares = allocate(
        next.savings,
        next.group.map((unit) => unit.price),
      );
      next.group.forEach((unit, index) => {
        unit.used = true;
        savingsByItem.set(unit.itemId, (savingsByItem.get(unit.itemId) ?? 0) + shares[index]);
      });
      times += 1;
      savings += next.savings;
      next = nextGroup(deal, units);
    }
    if (times > 0) applied.push({ dealId: deal.id, name: deal.name, times, savings });
  }

  const savings = applied.reduce((total, deal) => total + deal.savings, 0);
  const nudges = active.map((deal) => nudgeFor(deal, units)).filter((n) => n !== null);
  return { subtotal, applied, savingsByItem, savings, total: subtotal - savings, nudges };
}

/** What to actually charge: the total typed by hand if there is one, else the worked-out total. */
export function chargeFor(cart: Cart, pricing: Pricing): Cents {
  return cart.customTotal ?? pricing.total;
}
