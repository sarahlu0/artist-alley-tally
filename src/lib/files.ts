/**
 * Opens the share sheet on touch devices, otherwise downloads the file.
 * Resolves to false if the share sheet was dismissed.
 */
export async function saveFile(name: string, content: string, mimeType: string): Promise<boolean> {
  const file = new File([content], name, { type: mimeType });
  const onTouchDevice = window.matchMedia('(pointer: coarse)').matches;

  if (onTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** "ScottyCon 2026!" -> "scottycon-2026" */
export function fileSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'event';
}

const PHOTO_SIZE = 320;
export const MAX_PHOTO_LENGTH = 400_000;

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let alpha = 3; alpha < pixels.length; alpha += 4) {
    if (pixels[alpha] < 255) return true;
  }
  return false;
}

/**
 * Scales an image down to PHOTO_SIZE and returns a data URL. Images with
 * transparency stay PNG when that fits under the limit; everything else is JPEG.
 */
export async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  if (hasTransparency(context, canvas.width, canvas.height)) {
    const png = canvas.toDataURL('image/png');
    if (png.length < MAX_PHOTO_LENGTH) return png;
  }
  // JPEG has no alpha channel, and transparent pixels would otherwise turn black.
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
