import { get, set } from 'idb-keyval';
import type {
  AppliedDeal,
  AppState,
  Cart,
  Category,
  Deal,
  Item,
  Payment,
  Photos,
  Sale,
  SaleLine,
  TallyEvent,
} from '../types';
import { MONEY_METHODS } from '../types';
import { normalizeColor } from './colors';
import { DEFAULT_CURRENCY } from './money';

// Everything lives in the browser's own database on this device. Nothing is
// sent anywhere, which is also why the app keeps working without a connection.
const STATE_KEY = 'tally-state';
const PHOTOS_KEY = 'tally-photos';
const UNREADABLE_KEY = 'tally-state-unreadable';
const BACKUP_MARKER = 'artist-alley-tally';

type Raw = Record<string, unknown>;

class InvalidData extends Error {}

function fail(what: string): never {
  throw new InvalidData(`Unexpected ${what}`);
}

function record(value: unknown, what: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(what);
  return value as Raw;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string') fail(what);
  return value.slice(0, 200);
}

function int(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(what);
  return Math.round(value);
}

function list<T>(value: unknown, what: string, read: (entry: Raw) => T): T[] {
  if (!Array.isArray(value)) fail(what);
  return value.map((entry) => read(record(entry, what)));
}

function texts(value: unknown, what: string): string[] {
  if (!Array.isArray(value)) fail(what);
  return value.map((entry) => text(entry, what));
}

function payment(value: unknown): Payment {
  const known: readonly string[] = [...MONEY_METHODS, 'trade', 'gift'];
  if (typeof value !== 'string' || !known.includes(value)) fail('payment');
  return value as Payment;
}

function nullable<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === null || value === undefined ? null : read(value);
}

const readCategory = (raw: Raw): Category => ({
  id: text(raw.id, 'category'),
  name: text(raw.name, 'category'),
  color: normalizeColor(text(raw.color, 'category')),
});

/** Up to 4 characters, such as $, €, £, ¥ or CA$. Older saves have none. */
function currency(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CURRENCY;
  const trimmed = value.trim().slice(0, 4);
  return trimmed || DEFAULT_CURRENCY;
}

const readItem = (raw: Raw): Item => ({
  id: text(raw.id, 'item'),
  name: text(raw.name, 'item'),
  categoryId: text(raw.categoryId, 'item'),
  price: Math.max(0, int(raw.price, 'item price')),
  stock: int(raw.stock, 'item stock'),
});

const readDeal = (raw: Raw): Deal => {
  const kind = raw.kind;
  if (kind !== 'mix' && kind !== 'set' && kind !== 'bogo') fail('deal');
  return {
    id: text(raw.id, 'deal'),
    name: text(raw.name, 'deal'),
    enabled: raw.enabled === true,
    kind,
    categoryIds: texts(raw.categoryIds, 'deal'),
    itemIds: texts(raw.itemIds, 'deal'),
    quantity: Math.max(1, int(raw.quantity, 'deal')),
    price: Math.max(0, int(raw.price, 'deal')),
  };
};

const readCart = (raw: Raw): Cart => ({
  id: text(raw.id, 'order'),
  label: text(raw.label, 'order'),
  lines: list(raw.lines, 'order', (line) => ({
    itemId: text(line.itemId, 'order'),
    qty: Math.max(1, int(line.qty, 'order')),
  })),
  customTotal: nullable(raw.customTotal, (value) => Math.max(0, int(value, 'order'))),
});

const readSaleLine = (raw: Raw): SaleLine => {
  const qty = Math.max(1, int(raw.qty, 'sale'));
  const unitPrice = Math.max(0, int(raw.unitPrice, 'sale'));
  return {
    itemId: text(raw.itemId, 'sale'),
    name: text(raw.name, 'sale'),
    categoryId: text(raw.categoryId, 'sale'),
    categoryName: text(raw.categoryName, 'sale'),
    qty,
    unitPrice,
    paid: Math.max(0, int(raw.paid ?? qty * unitPrice, 'sale')),
  };
};

const readAppliedDeal = (raw: Raw): AppliedDeal => ({
  dealId: text(raw.dealId, 'sale'),
  name: text(raw.name, 'sale'),
  times: int(raw.times, 'sale'),
  savings: int(raw.savings, 'sale'),
});

const readSale = (raw: Raw): Sale => ({
  id: text(raw.id, 'sale'),
  eventId: text(raw.eventId, 'sale'),
  at: int(raw.at, 'sale'),
  lines: list(raw.lines, 'sale', readSaleLine),
  deals: list(raw.deals, 'sale', readAppliedDeal),
  subtotal: int(raw.subtotal, 'sale'),
  total: Math.max(0, int(raw.total, 'sale')),
  payment: payment(raw.payment),
  adjusted: raw.adjusted === true,
});

const readEvent = (raw: Raw): TallyEvent => ({
  id: text(raw.id, 'event'),
  name: text(raw.name, 'event'),
  startedAt: int(raw.startedAt, 'event'),
  endedAt: nullable(raw.endedAt, (value) => int(value, 'event')),
  cashFloat: Math.max(0, int(raw.cashFloat, 'event')),
  leftover: nullable(raw.leftover, (value) => {
    const entries = Object.entries(record(value, 'event'));
    return Object.fromEntries(entries.map(([id, count]) => [id, int(count, 'event')]));
  }),
});

/**
 * Rebuilds a state object field by field from untrusted data (a backup file
 * or an older save). Anything that doesn't look right is rejected, and
 * unknown fields are dropped.
 */
export function readState(value: unknown): AppState | null {
  try {
    const raw = record(value, 'data');
    if (raw.version !== 1) return null;

    const events = list(raw.events, 'events', readEvent);
    const carts = list(raw.carts, 'orders', readCart);
    const currentEventId = text(raw.currentEventId, 'event');
    const activeCartId = text(raw.activeCartId, 'order');
    if (!events.some((event) => event.id === currentEventId)) return null;
    if (!carts.some((cart) => cart.id === activeCartId)) return null;

    const categories = list(raw.categories, 'categories', readCategory);
    const known = new Set(categories.map((category) => category.id));
    // An item whose category is missing would show up nowhere, so it becomes uncategorized.
    const items = list(raw.items, 'items', readItem).map((item) =>
      known.has(item.categoryId) ? item : { ...item, categoryId: '' },
    );

    return {
      version: 1,
      categories,
      items,
      deals: list(raw.deals, 'deals', readDeal),
      events,
      currentEventId,
      sales: list(raw.sales, 'sales', readSale),
      carts,
      activeCartId,
      welcomed: raw.welcomed === true,
      lastBackupAt: nullable(raw.lastBackupAt, (at) => int(at, 'backup time')),
      currency: currency(raw.currency),
    };
  } catch (error) {
    if (error instanceof InvalidData) return null;
    throw error;
  }
}

/** Keeps only real, reasonably small images so a bad file can't smuggle in anything else. */
export function readPhotos(value: unknown): Photos {
  if (typeof value !== 'object' || value === null) return {};
  const photos: Photos = {};
  for (const [id, url] of Object.entries(value)) {
    const isImage = typeof url === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(url);
    if (isImage && url.length < 400_000) photos[id] = url;
  }
  return photos;
}

export async function loadSaved(): Promise<{ state: AppState | null; photos: Photos }> {
  const [saved, photos] = await Promise.all([get(STATE_KEY), get(PHOTOS_KEY)]);
  const state = readState(saved);
  // Never let a fresh start overwrite data we couldn't make sense of: park a copy first.
  if (saved !== undefined && state === null) await set(UNREADABLE_KEY, saved);
  return { state, photos: readPhotos(photos) };
}

export function saveState(state: AppState): Promise<void> {
  return set(STATE_KEY, state);
}

export function savePhotos(photos: Photos): Promise<void> {
  return set(PHOTOS_KEY, photos);
}

/** Asks the browser not to clear our data when the device runs low on space. */
export function requestPersistence(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}

export function buildBackup(state: AppState, photos: Photos, now: number): string {
  return JSON.stringify({ app: BACKUP_MARKER, exportedAt: now, state, photos });
}

export function readBackup(fileText: string): { state: AppState; photos: Photos } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const backup = parsed as Raw;
  if (backup.app !== BACKUP_MARKER) return null;
  const state = readState(backup.state);
  return state ? { state, photos: readPhotos(backup.photos) } : null;
}
