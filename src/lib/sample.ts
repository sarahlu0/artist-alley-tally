import type { Category, Deal, Item } from '../types';

/**
 * A small pretend table so people can try selling before typing in their own
 * items. Ids are fixed so loading it twice replaces instead of duplicating.
 */
const categories: Category[] = [
  { id: 'sample-prints', name: 'Prints', color: '#008080' },
  { id: 'sample-stickers', name: 'Stickers', color: '#ff8000' },
  { id: 'sample-charms', name: 'Charms', color: '#ff8080' },
];

const rows: Array<[name: string, categoryId: string, dollars: number, stock: number]> = [
  ['Moth Garden print', 'sample-prints', 10, 6],
  ['Night Market print', 'sample-prints', 10, 5],
  ['Tea Dragon print', 'sample-prints', 10, 6],
  ['Koi Pond print', 'sample-prints', 10, 2],
  ['Frog Wizard sticker', 'sample-stickers', 4, 10],
  ['Sleepy Cat sticker', 'sample-stickers', 4, 10],
  ['Boba Bear sticker', 'sample-stickers', 4, 8],
  ['Ghost Pal sticker', 'sample-stickers', 4, 8],
  ['Mushroom sticker', 'sample-stickers', 4, 10],
  ['Star Fox charm', 'sample-charms', 12, 5],
  ['Lucky Rabbit charm', 'sample-charms', 12, 4],
  ['Moon Jelly charm', 'sample-charms', 12, 4],
];

const items: Item[] = rows.map(([name, categoryId, dollars, stock], index) => ({
  id: `sample-item-${index}`,
  name,
  categoryId,
  price: dollars * 100,
  stock,
}));

const deals: Deal[] = [
  {
    id: 'sample-deal-prints',
    name: '2 Prints for $18',
    enabled: true,
    kind: 'mix',
    categoryIds: ['sample-prints'],
    itemIds: [],
    quantity: 2,
    price: 1800,
  },
  {
    id: 'sample-deal-stickers',
    name: '3 Stickers for $10',
    enabled: true,
    kind: 'mix',
    categoryIds: ['sample-stickers'],
    itemIds: [],
    quantity: 3,
    price: 1000,
  },
];

export const sampleTable = { categories, items, deals };
