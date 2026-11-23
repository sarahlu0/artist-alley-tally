import type { AppState, Category, Item } from '../types';
import { nextColor } from './colors';
import { parseMoney } from './money';
import { UNCATEGORIZED } from '../types';
import { formatTime } from './format';
import { isFree } from './payments';
import type { EventRecap } from './stats';

type Cell = string | number;

function escapeCell(cell: Cell): string {
  let value = String(cell);
  // Prevent CSV formula injection: spreadsheets evaluate cells starting with these.
  if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Parses CSV, or TSV when the first line has a tab (what spreadsheets put on the clipboard). */
export function parseTable(input: string): string[][] {
  const firstLine = input.split('\n', 1)[0];
  const separator = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === separator) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value !== ''));
}

export interface ImportRow {
  name: string;
  category: string;
  price: number;
  stock: number;
}

const COLUMN_NAMES = {
  name: ['name', 'item', 'product', 'title'],
  category: ['category', 'type', 'kind'],
  price: ['price', 'cost', 'unit price'],
  stock: ['stock', 'qty', 'quantity', 'count', 'amount'],
};

function findColumn(header: string[], names: string[]): number {
  return header.findIndex((cell) => names.includes(cell.toLowerCase()));
}

/**
 * With a recognized header row, columns can be in any order. Without one they
 * are read as Name, Price, Quantity, Category.
 */
export function readItemRows(table: string[][]): { rows: ImportRow[]; skipped: number } {
  if (table.length === 0) return { rows: [], skipped: 0 };

  const header = table[0];
  let columns = {
    name: findColumn(header, COLUMN_NAMES.name),
    category: findColumn(header, COLUMN_NAMES.category),
    price: findColumn(header, COLUMN_NAMES.price),
    stock: findColumn(header, COLUMN_NAMES.stock),
  };
  const hasHeader = columns.name !== -1 && columns.price !== -1;
  if (!hasHeader) columns = { name: 0, price: 1, stock: 2, category: 3 };

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const cells of hasHeader ? table.slice(1) : table) {
    const name = (cells[columns.name] ?? '').slice(0, 80);
    const price = parseMoney(cells[columns.price] ?? '');
    const stock = Number.parseInt(cells[columns.stock] ?? '', 10);
    if (!name || price === null) {
      skipped++;
      continue;
    }
    rows.push({
      name,
      price,
      stock: Number.isFinite(stock) ? Math.max(0, stock) : 0,
      category: (cells[columns.category] ?? '').slice(0, 40),
    });
  }
  return { rows, skipped };
}

/** Adds rows as items, or updates the existing item with the same name (case-insensitive). */
export function mergeImport(
  state: Pick<AppState, 'categories' | 'items'>,
  rows: ImportRow[],
  newId: () => string,
): { categories: Category[]; items: Item[]; added: number; updated: number } {
  const categories = [...state.categories];
  const items = [...state.items];
  let added = 0;
  let updated = 0;

  for (const row of rows) {
    let category = categories.find((c) => c.name.toLowerCase() === row.category.toLowerCase());
    if (!category && row.category) {
      category = { id: newId(), name: row.category, color: nextColor(categories.length) };
      categories.push(category);
    }
    const categoryId = category?.id ?? UNCATEGORIZED;
    const index = items.findIndex((item) => item.name.toLowerCase() === row.name.toLowerCase());
    if (index === -1) {
      items.push({
        id: newId(),
        name: row.name,
        categoryId,
        price: row.price,
        stock: row.stock,
      });
      added++;
    } else {
      items[index] = {
        ...items[index],
        categoryId,
        price: row.price,
        stock: row.stock,
      };
      updated++;
    }
  }
  return { categories, items, added, updated };
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** One row per sale line. */
export function salesCsv(state: AppState, eventId: string): string {
  const rows: Cell[][] = [
    [
      'Order',
      'Date',
      'Time',
      'Paid with',
      'Item',
      'Category',
      'Qty',
      'Price each',
      'Order total',
      'Deals',
      'Note',
    ],
  ];
  const sales = state.sales.filter((sale) => sale.eventId === eventId).reverse();
  sales.forEach((sale, index) => {
    const when = new Date(sale.at);
    const note = isFree(sale.payment)
      ? 'No money taken'
      : sale.adjusted
        ? 'Total typed by hand'
        : '';
    for (const line of sale.lines) {
      rows.push([
        index + 1,
        when.toLocaleDateString(),
        formatTime(sale.at),
        sale.payment,
        line.name,
        line.categoryName,
        line.qty,
        dollars(line.unitPrice),
        dollars(sale.total),
        sale.deals.map((deal) => deal.name).join('; '),
        note,
      ]);
    }
  });
  return toCsv(rows);
}

export function recapCsv(recap: EventRecap): string {
  const rows: Cell[][] = [
    ['Item', 'Category', 'Brought', 'Sold', 'Traded or gifted', 'Left', 'Money made'],
  ];
  for (const row of recap.items) {
    rows.push([
      row.name,
      row.categoryName,
      row.brought ?? '',
      row.sold,
      row.given,
      row.left ?? '',
      dollars(row.revenue),
    ]);
  }
  return toCsv(rows);
}
