/**
 * Reads the flattened composite image that PSD and PSB files store after their
 * layers, scaled down to fit `maxSide`. Layers themselves are never decoded.
 * Format reference: Adobe Photoshop File Formats Specification.
 */

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** Carries a message that can be shown to the user as is. */
export class PsdError extends Error {}

const COLOR_MODE = { gray: 1, rgb: 3, cmyk: 4 } as const;
const COLOR_CHANNELS: Record<number, number> = {
  [COLOR_MODE.gray]: 1,
  [COLOR_MODE.rgb]: 3,
  [COLOR_MODE.cmyk]: 4,
};
const VERSION_INFO_RESOURCE = 1057;
const MAX_PIXELS = 150_000_000;

export async function isPsd(file: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return String.fromCharCode(...bytes) === '8BPS';
}

async function readView(file: Blob, start: number, length: number): Promise<DataView> {
  const buffer = await file.slice(start, start + length).arrayBuffer();
  if (buffer.byteLength < length) throw new PsdError('That PSD file is incomplete.');
  return new DataView(buffer);
}

function readLength(view: DataView, offset: number, wide: boolean): number {
  return wide ? Number(view.getBigUint64(offset)) : view.getUint32(offset);
}

/** False only when the file says its composite is a placeholder (Maximize Compatibility off). */
function hasRealComposite(resources: DataView): boolean {
  let offset = 0;
  while (offset + 12 <= resources.byteLength) {
    const id = resources.getUint16(offset + 4);
    const nameLength = resources.getUint8(offset + 6);
    // The name is a Pascal string padded so that length byte + text is even.
    offset += 6 + nameLength + 1 + ((nameLength + 1) % 2);
    const size = resources.getUint32(offset);
    offset += 4;
    if (id === VERSION_INFO_RESOURCE && size >= 5) return resources.getUint8(offset + 4) !== 0;
    offset += size + (size % 2);
  }
  return true;
}

/** Decodes one PackBits-compressed row into `out`. */
function unpackBits(input: Uint8Array, out: Uint8Array) {
  let read = 0;
  let write = 0;
  while (write < out.length && read < input.length) {
    const header = (input[read++] << 24) >> 24;
    if (header >= 0) {
      const count = Math.min(header + 1, out.length - write, input.length - read);
      out.set(input.subarray(read, read + count), write);
      read += count;
      write += count;
    } else if (header !== -128) {
      const count = Math.min(1 - header, out.length - write);
      out.fill(input[read++], write, write + count);
      write += count;
    }
  }
}

export async function decodePsd(file: Blob, maxSide: number): Promise<DecodedImage> {
  const header = await readView(file, 0, 26);
  if (header.getUint32(0) !== 0x38425053) throw new PsdError('That isn’t a PSD file.');
  const version = header.getUint16(4);
  if (version !== 1 && version !== 2) throw new PsdError('That PSD version isn’t supported.');
  const wide = version === 2;
  const channelCount = header.getUint16(12);
  const height = header.getUint32(14);
  const width = header.getUint32(18);
  const depth = header.getUint16(22);
  const mode = header.getUint16(24);

  const colorChannels = COLOR_CHANNELS[mode];
  if (!colorChannels || (depth !== 8 && depth !== 16) || channelCount < colorChannels) {
    throw new PsdError(
      'Only RGB, CMYK and grayscale PSDs at 8 or 16 bits can be used. Export a PNG instead.',
    );
  }
  if (width === 0 || height === 0) throw new PsdError('That PSD is empty.');
  if (width * height > MAX_PIXELS)
    throw new PsdError('That PSD is too large. Export a smaller PNG instead.');

  let offset = 26;
  offset += 4 + (await readView(file, offset, 4)).getUint32(0);

  const resourcesLength = (await readView(file, offset, 4)).getUint32(0);
  const resources = await readView(file, offset + 4, resourcesLength);
  offset += 4 + resourcesLength;
  if (!hasRealComposite(resources)) {
    throw new PsdError(
      'That PSD was saved without Maximize Compatibility. Turn it on when saving, or export a PNG.',
    );
  }

  const lengthSize = wide ? 8 : 4;
  const layerSectionLength = readLength(await readView(file, offset, lengthSize), 0, wide);
  // A negative layer count means the first extra channel is the composite's transparency.
  let hasAlpha = false;
  if (layerSectionLength >= lengthSize + 2) {
    const layerInfo = await readView(file, offset + lengthSize, lengthSize + 2);
    hasAlpha = readLength(layerInfo, 0, wide) > 0 && layerInfo.getInt16(lengthSize) < 0;
  }
  hasAlpha &&= channelCount > colorChannels;
  offset += lengthSize + layerSectionLength;

  const compression = (await readView(file, offset, 2)).getUint16(0);
  offset += 2;
  if (compression !== 0 && compression !== 1)
    throw new PsdError('That PSD’s compression isn’t supported.');

  const bytesPerSample = depth / 8;
  const rowBytes = width * bytesPerSample;
  const channelsUsed = colorChannels + (hasAlpha ? 1 : 0);

  // Byte offset and length of every row of every used channel within the data section.
  const rowStart: number[][] = [];
  const rowLength: number[][] = [];
  let dataStart = offset;
  if (compression === 1) {
    const countSize = wide ? 4 : 2;
    const counts = await readView(file, offset, channelCount * height * countSize);
    dataStart += counts.byteLength;
    let position = 0;
    for (let channel = 0; channel < channelCount; channel++) {
      const starts: number[] = [];
      const lengths: number[] = [];
      for (let y = 0; y < height; y++) {
        const index = (channel * height + y) * countSize;
        const length = wide ? counts.getUint32(index) : counts.getUint16(index);
        starts.push(position);
        lengths.push(length);
        position += length;
      }
      if (channel < channelsUsed) {
        rowStart.push(starts);
        rowLength.push(lengths);
      }
    }
  } else {
    for (let channel = 0; channel < channelsUsed; channel++) {
      rowStart.push(Array.from({ length: height }, (_, y) => (channel * height + y) * rowBytes));
      rowLength.push(new Array<number>(height).fill(rowBytes));
    }
  }

  const lastChannel = channelsUsed - 1;
  const dataEnd = rowStart[lastChannel][height - 1] + rowLength[lastChannel][height - 1];
  const data = new Uint8Array(await file.slice(dataStart, dataStart + dataEnd).arrayBuffer());
  if (data.length < dataEnd) throw new PsdError('That PSD file is incomplete.');

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const columnOf = Uint32Array.from({ length: width }, (_, x) =>
    Math.floor((x * outWidth) / width),
  );

  // Box-filter sums, weighted by alpha so transparent pixels don't darken the edges.
  const colorSums = new Float64Array(outWidth * outHeight * 3);
  const alphaSums = new Float64Array(outWidth * outHeight);
  const counts = new Uint32Array(outWidth * outHeight);

  const raw = new Uint8Array(rowBytes);
  const rows = Array.from({ length: channelsUsed }, () => new Float64Array(width));
  for (let y = 0; y < height; y++) {
    for (let channel = 0; channel < channelsUsed; channel++) {
      const start = rowStart[channel][y];
      const source = data.subarray(start, start + rowLength[channel][y]);
      if (compression === 1) unpackBits(source, raw);
      else raw.set(source);
      const row = rows[channel];
      for (let x = 0; x < width; x++) {
        row[x] = bytesPerSample === 2 ? ((raw[x * 2] << 8) | raw[x * 2 + 1]) / 257 : raw[x];
      }
    }

    const outRow = Math.floor((y * outHeight) / height) * outWidth;
    for (let x = 0; x < width; x++) {
      const cell = outRow + columnOf[x];
      const alpha = hasAlpha ? rows[colorChannels][x] : 255;
      let r = rows[0][x];
      let g = mode === COLOR_MODE.gray ? r : rows[1][x];
      let b = mode === COLOR_MODE.gray ? r : rows[2][x];
      if (mode === COLOR_MODE.cmyk) {
        // PSD stores CMYK inverted (255 is no ink). A plain conversion, without a color profile.
        const k = rows[3][x] / 255;
        r *= k;
        g *= k;
        b *= k;
      }
      colorSums[cell * 3] += r * alpha;
      colorSums[cell * 3 + 1] += g * alpha;
      colorSums[cell * 3 + 2] += b * alpha;
      alphaSums[cell] += alpha;
      counts[cell] += 1;
    }
  }

  const pixels = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let cell = 0; cell < counts.length; cell++) {
    const alphaSum = alphaSums[cell];
    if (alphaSum > 0) {
      pixels[cell * 4] = Math.round(colorSums[cell * 3] / alphaSum);
      pixels[cell * 4 + 1] = Math.round(colorSums[cell * 3 + 1] / alphaSum);
      pixels[cell * 4 + 2] = Math.round(colorSums[cell * 3 + 2] / alphaSum);
    }
    pixels[cell * 4 + 3] = Math.round(alphaSum / counts[cell]);
  }
  return { width: outWidth, height: outHeight, data: pixels };
}
