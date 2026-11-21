import { describe, expect, it } from 'vitest';
import { mergeImport, parseTable, readItemRows, toCsv } from './csv';
import { createInitialState } from '../state/reducer';
import { formatMoney, parseMoney, setCurrencySymbol } from './money';
import { readBackup, readState } from './storage';

describe('spreadsheet import', () => {
  it('reads rows pasted from a spreadsheet with a header in any order', () => {
    const table = parseTable(
      'Category\tItem\tQty\tPrice\nStickers\tFrog\t10\t$4\nPrints\t"Big, shiny"\t\t12.50',
    );
    expect(readItemRows(table).rows).toEqual([
      { name: 'Frog', category: 'Stickers', price: 400, stock: 10 },
      { name: 'Big, shiny', category: 'Prints', price: 1250, stock: 0 },
    ]);
  });

  it('assumes Name, Price, Quantity, Category without a header and skips bad rows', () => {
    const { rows, skipped } = readItemRows(parseTable('Frog,4,10,Stickers\nno price here\n'));
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('updates an item with the same name instead of adding a twin', () => {
    let n = 0;
    const newId = () => `id-${n++}`;
    const first = mergeImport(
      { categories: [], items: [] },
      [{ name: 'Frog', category: 'Stickers', price: 400, stock: 10 }],
      newId,
    );
    const second = mergeImport(
      first,
      [{ name: 'frog', category: 'stickers', price: 500, stock: 3 }],
      newId,
    );
    expect(second.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({ price: 500, stock: 3 });
    expect(second.categories).toHaveLength(1);
  });
});

describe('price parsing', () => {
  it('reads prices with or without a symbol and rejects anything else', () => {
    expect(parseMoney('$4.50')).toBe(450);
    expect(parseMoney('CA$ 1,200')).toBe(120000);
    expect(parseMoney('3 for $10')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
  });
});

describe('spreadsheet export', () => {
  it('quotes commas and defuses cells that look like formulas', () => {
    expect(toCsv([['=SUM(A1)', 'a,b', 3]])).toBe(`'=SUM(A1),"a,b",3`);
  });
});

describe('saved data from older versions', () => {
  it('loads a save with no currency and old color names', () => {
    const old: Record<string, unknown> = {
      ...createInitialState('event', 'cart', 0),
      categories: [
        { id: 'a', name: 'Stickers', color: 'marigold' },
        { id: 'b', name: 'Prints', color: 'not-a-color' },
      ],
    };
    delete old.currency;
    const loaded = readState(old);
    expect(loaded?.currency).toBe('$');
    expect(loaded?.categories.map((c) => c.color)).toEqual(['#dba11c', '#808080']);
  });

  it('keeps a chosen currency symbol', () => {
    const state = { ...createInitialState('event', 'cart', 0), currency: '€' };
    expect(readState(state)?.currency).toBe('€');
  });
});

describe('backup files', () => {
  it('rejects files that are not Tally backups', () => {
    expect(readBackup('not json')).toBeNull();
    expect(readBackup('{"app":"something-else"}')).toBeNull();
    expect(readState({ version: 1, items: 'nope' })).toBeNull();
  });
});

describe('display helpers', () => {
  it('shows amounts with the chosen symbol', () => {
    setCurrencySymbol('€');
    expect(formatMoney(1250)).toBe('€12.50');
    setCurrencySymbol('$');
    expect(formatMoney(400)).toBe('$4');
  });
});
