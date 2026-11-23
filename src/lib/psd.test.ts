import { describe, expect, it } from 'vitest';
import { decodePsd, isPsd, PsdError } from './psd';

interface PsdSpec {
  width: number;
  height: number;
  /** Planar samples: channels[channel][y * width + x]. */
  channels: number[][];
  mode?: number;
  depth?: 8 | 16;
  version?: 1 | 2;
  compression?: 0 | 1;
  layerCount?: number;
  realComposite?: boolean;
}

class Writer {
  bytes: number[] = [];
  u8(value: number) {
    this.bytes.push(value & 0xff);
  }
  u16(value: number) {
    this.u8(value >> 8);
    this.u8(value);
  }
  u32(value: number) {
    this.u16(value >>> 16);
    this.u16(value);
  }
  length(value: number, wide: boolean) {
    if (wide) this.u32(0);
    this.u32(value);
  }
  append(other: number[]) {
    this.bytes.push(...other);
  }
}

function packBits(row: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < row.length) {
    let run = 1;
    while (i + run < row.length && run < 128 && row[i + run] === row[i]) run++;
    if (run >= 3) {
      out.push(257 - run, row[i]);
      i += run;
      continue;
    }
    const start = i;
    while (i < row.length && i - start < 128 && !(row[i] === row[i + 1] && row[i] === row[i + 2]))
      i++;
    out.push(i - start - 1, ...row.slice(start, i));
  }
  return out;
}

function buildPsd(spec: PsdSpec): Blob {
  const { width, height, channels, mode = 3, depth = 8, version = 1, compression = 1 } = spec;
  const wide = version === 2;
  const psd = new Writer();
  psd.append([...'8BPS'].map((char) => char.charCodeAt(0)));
  psd.u16(version);
  psd.append([0, 0, 0, 0, 0, 0]);
  psd.u16(channels.length);
  psd.u32(height);
  psd.u32(width);
  psd.u16(depth);
  psd.u16(mode);
  psd.u32(0);

  const resources = new Writer();
  if (spec.realComposite !== undefined) {
    resources.append([...'8BIM'].map((char) => char.charCodeAt(0)));
    resources.u16(1057);
    resources.append([0, 0]);
    resources.u32(6);
    resources.append([0, 0, 0, 1, spec.realComposite ? 1 : 0, 0]);
  }
  psd.u32(resources.bytes.length);
  psd.append(resources.bytes);

  const layers = new Writer();
  if (spec.layerCount !== undefined) {
    layers.length(2, wide);
    layers.u16(spec.layerCount & 0xffff);
  }
  psd.length(layers.bytes.length, wide);
  psd.append(layers.bytes);

  psd.u16(compression);
  const rows = channels.flatMap((samples) =>
    Array.from({ length: height }, (_, y) =>
      samples
        .slice(y * width, (y + 1) * width)
        .flatMap((value) => (depth === 16 ? [value >> 8, value & 0xff] : [value])),
    ),
  );
  if (compression === 0) {
    rows.forEach((row) => psd.append(row));
  } else {
    const packed = rows.map(packBits);
    packed.forEach((row) => (wide ? psd.u32(row.length) : psd.u16(row.length)));
    packed.forEach((row) => psd.append(row));
  }
  return new Blob([new Uint8Array(psd.bytes)]);
}

function pixel(image: { width: number; data: Uint8ClampedArray }, x: number, y: number) {
  const i = (y * image.width + x) * 4;
  return [...image.data.slice(i, i + 4)];
}

// A 3x2 RGBA image: red, transparent, a run of grays; then a long row of blue.
const RGBA = {
  width: 3,
  height: 2,
  channels: [
    [255, 0, 90, 0, 0, 0],
    [0, 0, 90, 0, 0, 0],
    [0, 0, 90, 255, 255, 255],
    [255, 0, 128, 255, 255, 255],
  ],
};

describe('decodePsd', () => {
  it('reads an RLE composite with transparency', async () => {
    const image = await decodePsd(buildPsd({ ...RGBA, layerCount: -2 }), 1000);
    expect([image.width, image.height]).toEqual([3, 2]);
    expect(pixel(image, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(image, 1, 0)[3]).toBe(0);
    expect(pixel(image, 2, 0)).toEqual([90, 90, 90, 128]);
    expect(pixel(image, 1, 1)).toEqual([0, 0, 255, 255]);
  });

  it('treats an extra channel as a saved selection, not transparency, without a negative layer count', async () => {
    const image = await decodePsd(buildPsd({ ...RGBA, layerCount: 2 }), 1000);
    expect(pixel(image, 1, 0)).toEqual([0, 0, 0, 255]);
  });

  it('reads uncompressed data', async () => {
    const image = await decodePsd(buildPsd({ ...RGBA, compression: 0, layerCount: -1 }), 1000);
    expect(pixel(image, 2, 0)).toEqual([90, 90, 90, 128]);
  });

  it('reads 16-bit grayscale', async () => {
    const psd = buildPsd({ width: 2, height: 1, mode: 1, depth: 16, channels: [[0, 65535]] });
    const image = await decodePsd(psd, 1000);
    expect(pixel(image, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(image, 1, 0)).toEqual([255, 255, 255, 255]);
  });

  it('converts CMYK, which PSD stores inverted', async () => {
    const psd = buildPsd({
      width: 2,
      height: 1,
      mode: 4,
      channels: [
        [255, 255],
        [255, 255],
        [255, 255],
        [255, 0],
      ],
    });
    const image = await decodePsd(psd, 1000);
    expect(pixel(image, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(image, 1, 0)).toEqual([0, 0, 0, 255]);
  });

  it('reads PSB (large document format)', async () => {
    const image = await decodePsd(buildPsd({ ...RGBA, version: 2, layerCount: -1 }), 1000);
    expect(pixel(image, 2, 0)).toEqual([90, 90, 90, 128]);
  });

  it('averages down to maxSide, weighting color by alpha', async () => {
    const psd = buildPsd({
      width: 2,
      height: 1,
      layerCount: -1,
      channels: [
        [255, 0],
        [0, 0],
        [0, 0],
        [255, 0],
      ],
    });
    const image = await decodePsd(psd, 1);
    expect([image.width, image.height]).toEqual([1, 1]);
    // The transparent black pixel lowers alpha without darkening the red.
    expect(pixel(image, 0, 0)).toEqual([255, 0, 0, 128]);
  });

  it('decodes a large image without allocating it at full size', async () => {
    const size = 1200;
    const plane = new Array<number>(size * size).fill(200);
    const psd = buildPsd({ width: size, height: size, channels: [plane, plane, plane] });
    const image = await decodePsd(psd, 320);
    expect([image.width, image.height]).toEqual([320, 320]);
    expect(pixel(image, 319, 319)).toEqual([200, 200, 200, 255]);
  });

  it('explains a file saved without Maximize Compatibility', async () => {
    const psd = buildPsd({ ...RGBA, realComposite: false });
    await expect(decodePsd(psd, 1000)).rejects.toThrow(/Maximize Compatibility/);
    await expect(decodePsd(buildPsd({ ...RGBA, realComposite: true }), 1000)).resolves.toBeTruthy();
  });

  it('rejects color modes it cannot show', async () => {
    const indexed = buildPsd({ width: 1, height: 1, mode: 2, channels: [[0]] });
    await expect(decodePsd(indexed, 1000)).rejects.toBeInstanceOf(PsdError);
  });

  it('rejects a cut-off file', async () => {
    const whole = new Uint8Array(await buildPsd({ ...RGBA, layerCount: -1 }).arrayBuffer());
    const cut = new Blob([whole.slice(0, whole.length - 4)]);
    await expect(decodePsd(cut, 1000)).rejects.toThrow(/incomplete/);
  });
});

describe('isPsd', () => {
  it('checks the file signature, not the name or type', async () => {
    expect(await isPsd(buildPsd(RGBA))).toBe(true);
    expect(await isPsd(new Blob(['\x89PNG']))).toBe(false);
  });
});
