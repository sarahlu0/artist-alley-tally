/**
 * Category colors are stored as "#rrggbb". The presets are the classic Paint
 * palette, minus the shades too pale to show up as a tile color.
 */
export const PALETTE: Array<{ hex: string; name: string }> = [
  { hex: '#000000', name: 'Black' },
  { hex: '#808080', name: 'Gray' },
  { hex: '#800000', name: 'Maroon' },
  { hex: '#808000', name: 'Olive' },
  { hex: '#008000', name: 'Green' },
  { hex: '#008080', name: 'Teal' },
  { hex: '#000080', name: 'Navy' },
  { hex: '#800080', name: 'Purple' },
  { hex: '#804000', name: 'Brown' },
  { hex: '#004040', name: 'Dark teal' },
  { hex: '#ff0000', name: 'Red' },
  { hex: '#ff8000', name: 'Orange' },
  { hex: '#e0c000', name: 'Yellow' },
  { hex: '#00a000', name: 'Bright green' },
  { hex: '#00a0a0', name: 'Cyan' },
  { hex: '#0000ff', name: 'Blue' },
  { hex: '#ff00ff', name: 'Magenta' },
  { hex: '#ff8080', name: 'Pink' },
  { hex: '#80c0ff', name: 'Sky blue' },
  { hex: '#c080ff', name: 'Lavender' },
];

// Older saves stored a swatch name instead of a hex value.
const LEGACY_NAMES: Record<string, string> = {
  tomato: '#d2553c',
  marigold: '#dba11c',
  moss: '#6f8f3c',
  teal: '#2e8a84',
  sky: '#4a88c2',
  plum: '#8a5aa3',
  rose: '#d0688c',
  clay: '#a67c5b',
};

const FALLBACK = '#808080';

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Turns whatever was saved into a usable "#rrggbb", lowercase. */
export function normalizeColor(value: string): string {
  if (isHexColor(value)) return value.toLowerCase();
  return LEGACY_NAMES[value] ?? FALLBACK;
}

/** Reads a typed hex code, with or without the "#". Null if it isn't one. */
export function parseHex(text: string): string | null {
  const value = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
  return isHexColor(value) ? value.toLowerCase() : null;
}

/** Picks a color for a new category, skipping black and gray. */
export function nextColor(usedCount: number): string {
  const bright = PALETTE.slice(10);
  return bright[usedCount % bright.length].hex;
}
