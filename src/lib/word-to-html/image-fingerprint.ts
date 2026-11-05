/**
 * Mode Utility: Image Fingerprint (Image Library)
 *
 * Alt text alone misidentifies images: the same banner appears with varied
 * punctuation, and different banners can share one alt text. A fingerprint
 * compares a 64x36 grayscale grid and a 16x9 RGB grid. The color guard
 * distinguishes product variants that have the same luminance. Two
 * fingerprints match only when both grids stay within the threshold.
 *
 * The grid is computed by exact box-averaging over the full-resolution
 * pixels in plain JS; the canvas only decodes the image. drawImage
 * downscaling is not used for the reduction, so the fingerprint does not
 * depend on the browser's resampling and is identical to the calibrated
 * algorithm. Transparency is composited over white, the way pages render.
 *
 * Calibration on 22 real banner images (231 pairs, 400x225 through
 * 1920x1080, Shopify originals, Google Docs re-encodes, and resized
 * variants): the same banner never differed by more than 20.1 per cell;
 * different banners never came closer than 159.3, and a synthetic word-sized
 * edit scored 190.8. The threshold 50 sits in that gap with margin on both
 * sides. Those measurements calibrate the grayscale grid; the RGB grid is
 * an additional conservative veto, not a reason to loosen that threshold.
 *
 * Both image hosts (cdn.shopify.com and the Google Docs image host) send
 * Access-Control-Allow-Origin: *, so the browser may read their pixels when
 * the image is loaded with crossOrigin="anonymous" (set before src, or the
 * request is not a CORS request and the canvas is tainted).
 */

export const FINGERPRINT_WIDTH = 64;
export const FINGERPRINT_HEIGHT = 36;
const GRAYSCALE_LENGTH = FINGERPRINT_WIDTH * FINGERPRINT_HEIGHT;
const COLOR_WIDTH = 16;
const COLOR_HEIGHT = 9;
const COLOR_LENGTH = COLOR_WIDTH * COLOR_HEIGHT * 3;
export const FINGERPRINT_LENGTH = GRAYSCALE_LENGTH + COLOR_LENGTH;
/** Max per-cell grayscale difference (0-255) for two pictures to match. */
export const FINGERPRINT_THRESHOLD = 50;
/**
 * Distance within the calibrated same-image range (max observed 20.1, plus
 * headroom for browser decode variance): a high-confidence picture match.
 * Between this and FINGERPRINT_THRESHOLD the match is medium confidence.
 */
export const FINGERPRINT_HIGH_DISTANCE = 25;

/**
 * How certain a match is. Only a high-confidence match is ever applied:
 * medium (a picture match outside the calibrated same-image range) is held.
 */
export type MatchConfidence = 'high' | 'medium';

/** The confidence of a picture match at this distance; null when no match. */
export function matchConfidence(distance: number): MatchConfidence | null {
  if (distance <= FINGERPRINT_HIGH_DISTANCE) return 'high';
  if (distance <= FINGERPRINT_THRESHOLD) return 'medium';
  return null;
}

/**
 * Decoding huge images at natural size costs memory (RGBA of an 8000px
 * image is ~100MB), so larger ones are first drawn within this many pixels.
 * Banners are far smaller and skip this.
 */
const MAX_DECODE_PIXELS = 4_000_000;

type FingerprintPixelSource = Uint8ClampedArray | ((firstRow: number, rowCount: number) => Uint8ClampedArray);

/**
 * RGBA pixels of any size reduced to the grayscale grid: Rec. 601 luma,
 * transparency composited over white, exact box average per cell.
 */
function* fingerprintPixelChunks(pixels: FingerprintPixelSource, width: number, height: number): Generator<void, Uint8Array> {
  const sums = new Float64Array(FINGERPRINT_LENGTH);
  const counts = new Uint32Array(GRAYSCALE_LENGTH);
  const colorCounts = new Uint32Array(COLOR_WIDTH * COLOR_HEIGHT);
  const rowsPerChunk = Math.max(1, Math.floor(65_536 / width));
  const readRows = typeof pixels === 'function' ? pixels : null;
  let rgba = typeof pixels === 'function' ? new Uint8ClampedArray() : pixels;
  for (let y = 0; y < height; y++) {
    if (readRows && y % rowsPerChunk === 0) rgba = readRows(y, Math.min(rowsPerChunk, height - y));
    const cellY = Math.min(FINGERPRINT_HEIGHT - 1, Math.floor(y * FINGERPRINT_HEIGHT / height));
    const rowOffset = (readRows ? y % rowsPerChunk : y) * width;
    const cellRow = cellY * FINGERPRINT_WIDTH;
    const colorRow = Math.min(COLOR_HEIGHT - 1, Math.floor(y * COLOR_HEIGHT / height)) * COLOR_WIDTH;
    for (let x = 0; x < width; x++) {
      const o = (rowOffset + x) * 4;
      const alpha = rgba[o + 3] / 255;
      const luma = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) * alpha + 255 * (1 - alpha);
      const cell = cellRow + Math.min(FINGERPRINT_WIDTH - 1, Math.floor(x * FINGERPRINT_WIDTH / width));
      sums[cell] += luma;
      counts[cell]++;
      const colorCell = colorRow + Math.min(COLOR_WIDTH - 1, Math.floor(x * COLOR_WIDTH / width));
      colorCounts[colorCell]++;
      for (let channel = 0; channel < 3; channel++) {
        sums[GRAYSCALE_LENGTH + colorCell * 3 + channel] += rgba[o + channel] * alpha + 255 * (1 - alpha);
      }
    }
    if ((y + 1) % rowsPerChunk === 0 && y + 1 < height) yield;
  }
  const cells = new Uint8Array(FINGERPRINT_LENGTH);
  for (let i = 0; i < FINGERPRINT_LENGTH; i++) {
    const count = i < GRAYSCALE_LENGTH ? counts[i] : colorCounts[Math.floor((i - GRAYSCALE_LENGTH) / 3)];
    cells[i] = count ? Math.round(sums[i] / count) : 255;
  }
  return cells;
}

/** Synchronous calibration uses the exact same reduction as the browser path. */
export function fingerprintFromPixels(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const chunks = fingerprintPixelChunks(rgba, width, height);
  let result = chunks.next();
  while (!result.done) result = chunks.next();
  return result.value;
}

/** Let scrolling, input and paints run between chunks; cancelled drafts stop early. */
export async function fingerprintFromPixelsAsync(
  pixels: FingerprintPixelSource, width: number, height: number, signal?: AbortSignal
): Promise<Uint8Array | null> {
  const chunks = fingerprintPixelChunks(pixels, width, height);
  while (!signal?.aborted) {
    const result = chunks.next();
    if (result.done) return result.value;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return null;
}

/** The largest per-cell difference; Infinity when either side is missing. */
export function fingerprintDistance(a: Uint8Array | null, b: Uint8Array | null): number {
  if (!a || !b || a.length !== FINGERPRINT_LENGTH || b.length !== FINGERPRINT_LENGTH) return Infinity;
  let max = 0;
  for (let i = 0; i < FINGERPRINT_LENGTH; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > max) max = d;
  }
  return max;
}

export function fingerprintsMatch(a: Uint8Array | null, b: Uint8Array | null): boolean {
  return fingerprintDistance(a, b) <= FINGERPRINT_THRESHOLD;
}

/** Fingerprint bytes as base64 for storage. */
export function encodeFingerprint(cells: Uint8Array): string {
  let binary = '';
  cells.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

/** Stored base64 back to fingerprint bytes; null when malformed. */
export function decodeFingerprint(encoded: unknown): Uint8Array | null {
  if (typeof encoded !== 'string' || !encoded) return null;
  try {
    const binary = atob(encoded);
    // Keep legacy grayscale data readable/exportable until backfill succeeds.
    // fingerprintDistance never accepts it as a verified color match.
    if (binary.length !== FINGERPRINT_LENGTH && binary.length !== GRAYSCALE_LENGTH) return null;
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Legacy entries retain their URLs/descriptions and are upgraded lazily. */
export function isCurrentFingerprint(encoded: unknown): boolean {
  return decodeFingerprint(encoded)?.length === FINGERPRINT_LENGTH;
}

/**
 * Loads an image and computes its fingerprint in the browser. Returns null
 * when the image cannot be loaded or its pixels cannot be read (no CORS
 * header, broken URL, or no canvas); unreadable pictures are never matched.
 */
export async function loadFingerprint(src: string, signal?: AbortSignal): Promise<Uint8Array | null> {
  try {
    if (signal?.aborted) return null;
    const image = new Image();
    // crossOrigin must be set before src or the canvas is tainted
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image load timed out')), 15000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error(`Image failed to load: ${src.slice(0, 80)}`)); };
      image.src = src;
    });
    // Decode off the rendering path instead of making the first canvas read
    // synchronously decode a large pasted image.
    await image.decode();
    // Image onload continuations otherwise do canvas readback and reduction
    // in the same task, before the browser can paint the pasted document.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (signal?.aborted) return null;
    const scale = Math.min(1, Math.sqrt(MAX_DECODE_PIXELS / (image.naturalWidth * image.naturalHeight)));
    const width = Math.max(FINGERPRINT_WIDTH, Math.round(image.naturalWidth * scale));
    const height = Math.max(FINGERPRINT_HEIGHT, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    // Clip the same full-image draw to one strip at a time. This preserves
    // resampling coordinates without a full-size canvas/readback long task.
    return await fingerprintFromPixelsAsync(
      (firstRow, rowCount) => {
        if (canvas.height !== rowCount) canvas.height = rowCount;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, rowCount);
        context.drawImage(image, 0, -firstRow, width, height);
        return context.getImageData(0, 0, width, rowCount).data;
      },
      width, height, signal
    );
  } catch {
    return null;
  }
}
