/**
 * Mode Utility: Image Fingerprint (Image Library)
 *
 * Alt text alone misidentifies images: the same banner appears with varied
 * punctuation, and different banners can share one alt text. A fingerprint
 * compares the pictures themselves: the image reduced to a 64x36 grayscale
 * grid (2304 bytes). Two fingerprints match when no grid cell differs by
 * more than the threshold.
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
 * sides.
 *
 * Both image hosts (cdn.shopify.com and the Google Docs image host) send
 * Access-Control-Allow-Origin: *, so the browser may read their pixels when
 * the image is loaded with crossOrigin="anonymous" (set before src, or the
 * request is not a CORS request and the canvas is tainted).
 */

export const FINGERPRINT_WIDTH = 64;
export const FINGERPRINT_HEIGHT = 36;
export const FINGERPRINT_LENGTH = FINGERPRINT_WIDTH * FINGERPRINT_HEIGHT;
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
 * medium (a picture match outside the calibrated same-image range) and low
 * (alt text only, pictures not compared) are reported and left as text.
 */
export type MatchConfidence = 'high' | 'medium' | 'low';

/** The confidence of a picture match at this distance; null when no match. */
export function matchConfidence(distance: number): Exclude<MatchConfidence, 'low'> | null {
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

/**
 * RGBA pixels of any size reduced to the grayscale grid: Rec. 601 luma,
 * transparency composited over white, exact box average per cell.
 */
export function fingerprintFromPixels(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const sums = new Float64Array(FINGERPRINT_LENGTH);
  const counts = new Uint32Array(FINGERPRINT_LENGTH);
  for (let y = 0; y < height; y++) {
    const cellY = Math.min(FINGERPRINT_HEIGHT - 1, Math.floor(y * FINGERPRINT_HEIGHT / height));
    const rowOffset = y * width;
    const cellRow = cellY * FINGERPRINT_WIDTH;
    for (let x = 0; x < width; x++) {
      const o = (rowOffset + x) * 4;
      const alpha = rgba[o + 3] / 255;
      const luma = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) * alpha + 255 * (1 - alpha);
      const cell = cellRow + Math.min(FINGERPRINT_WIDTH - 1, Math.floor(x * FINGERPRINT_WIDTH / width));
      sums[cell] += luma;
      counts[cell]++;
    }
  }
  const cells = new Uint8Array(FINGERPRINT_LENGTH);
  for (let i = 0; i < FINGERPRINT_LENGTH; i++) {
    cells[i] = counts[i] ? Math.round(sums[i] / counts[i]) : 255;
  }
  return cells;
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
    if (binary.length !== FINGERPRINT_LENGTH) return null;
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Loads an image and computes its fingerprint in the browser. Returns null
 * when the image cannot be loaded or its pixels cannot be read (no CORS
 * header, broken URL, or no canvas); callers fall back to alt-text matching.
 */
export async function loadFingerprint(src: string): Promise<Uint8Array | null> {
  try {
    const image = new Image();
    // crossOrigin must be set before src or the canvas is tainted
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image load timed out')), 15000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error(`Image failed to load: ${src.slice(0, 80)}`)); };
      image.src = src;
    });
    const scale = Math.min(1, Math.sqrt(MAX_DECODE_PIXELS / (image.naturalWidth * image.naturalHeight)));
    const width = Math.max(FINGERPRINT_WIDTH, Math.round(image.naturalWidth * scale));
    const height = Math.max(FINGERPRINT_HEIGHT, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // White behind the image, the way pages render transparency
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    return fingerprintFromPixels(rgba, width, height);
  } catch {
    return null;
  }
}
