/** Preset category colors. Pale shades are left out because they vanish as a tile accent. */
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

/** Accepts a hex color or a legacy swatch name. */
export function normalizeColor(value: string): string {
  if (isHexColor(value)) return value.toLowerCase();
  return LEGACY_NAMES[value] ?? FALLBACK;
}

/** Parses user-typed hex, with or without the leading #. */
export function parseHex(text: string): string | null {
  const value = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
  return isHexColor(value) ? value.toLowerCase() : null;
}

const BRIGHT = PALETTE.slice(PALETTE.findIndex((swatch) => swatch.name === 'Red'));

/** Cycles through the brighter half of the palette for new categories. */
export function nextColor(usedCount: number): string {
  return BRIGHT[usedCount % BRIGHT.length].hex;
}
