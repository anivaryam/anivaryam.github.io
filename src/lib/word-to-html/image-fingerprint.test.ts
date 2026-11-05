import { describe, expect, it } from 'vitest';
import {
  FINGERPRINT_HEIGHT,
  FINGERPRINT_LENGTH,
  FINGERPRINT_THRESHOLD,
  FINGERPRINT_WIDTH,
  decodeFingerprint,
  encodeFingerprint,
  fingerprintDistance,
  fingerprintFromPixels,
  fingerprintFromPixelsAsync,
  fingerprintsMatch,
  isCurrentFingerprint,
} from './image-fingerprint';

const fp = (value: number) => new Uint8Array(FINGERPRINT_LENGTH).fill(value);

describe('image fingerprint', () => {
  it('reduces grid-sized RGBA to grayscale cells (Rec. 601, alpha over white)', () => {
    const rgba = new Uint8ClampedArray(FINGERPRINT_LENGTH * 4);
    rgba.set([255, 0, 0, 255], 0); // red
    rgba.set([0, 255, 0, 255], 4); // green
    rgba.set([0, 0, 0, 255], 8); // black
    rgba.set([0, 0, 0, 0], 12); // fully transparent reads as the white page
    rgba.set([0, 0, 0, 128], 16); // half-transparent black over white
    const cells = fingerprintFromPixels(rgba, FINGERPRINT_WIDTH, FINGERPRINT_HEIGHT);
    expect(cells.length).toBe(FINGERPRINT_LENGTH);
    expect(Array.from(cells.slice(0, 5))).toEqual([76, 150, 0, 255, 127]);
  });

  it('box-averages full-resolution pixels exactly into each cell', () => {
    // 128x72: each cell covers a 2x2 block; one block holds 0,0,255,255
    const width = FINGERPRINT_WIDTH * 2;
    const height = FINGERPRINT_HEIGHT * 2;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const [x, y] of [[0, 0], [1, 0]]) {
      rgba.set([0, 0, 0, 255], (y * width + x) * 4);
    }
    const cells = fingerprintFromPixels(rgba, width, height);
    expect(cells[0]).toBe(128); // (0 + 0 + 255 + 255) / 4, rounded
    expect(cells[1]).toBe(255);
    expect(cells[FINGERPRINT_LENGTH - 1]).toBe(255);
  });

  it('spreads pixels of a non-multiple size over every cell', () => {
    // 97x53 shares no factor with 64x36; every cell must still get pixels
    const width = 97;
    const height = 53;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    const cells = fingerprintFromPixels(rgba, width, height);
    expect(Array.from(cells).every(value => value === 255)).toBe(true);
  });

  it.each([[97, 53], [1920, 1080]])('keeps asynchronous fingerprints byte-identical at %sx%s', async (width, height) => {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 17 + Math.floor(i / 100)) % 256;
    const expected = fingerprintFromPixels(rgba, width, height);
    expect(await fingerprintFromPixelsAsync(rgba, width, height)).toEqual(expected);
    const reads: number[] = [];
    expect(await fingerprintFromPixelsAsync((firstRow, rowCount) => {
      reads.push(width * rowCount);
      return rgba.subarray(firstRow * width * 4, (firstRow + rowCount) * width * 4);
    }, width, height)).toEqual(expected);
    expect(reads.every(count => count <= 65_536)).toBe(true);
  });

  it('lets another task run before completing a large fingerprint', async () => {
    const rgba = new Uint8ClampedArray(512 * 512 * 4).fill(255);
    let finished = false;
    const pending = fingerprintFromPixelsAsync(rgba, 512, 512).then(result => { finished = true; return result; });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    expect(await pending).toEqual(fp(255));
  });

  it('stops queued pixel work when the draft is cancelled', async () => {
    const controller = new AbortController();
    const pending = fingerprintFromPixelsAsync(new Uint8ClampedArray(512 * 512 * 4), 512, 512, controller.signal);
    controller.abort();
    expect(await pending).toBeNull();
    expect(await fingerprintFromPixelsAsync(new Uint8ClampedArray(), 0, 0, controller.signal)).toBeNull();
  });

  it('measures the largest per-cell difference', () => {
    const a = fp(100);
    const b = fp(100);
    b[5] = 30; // one cell differs by 70 (a localized word-sized change)
    expect(fingerprintDistance(a, fp(100))).toBe(0);
    expect(fingerprintDistance(a, b)).toBe(70);
    expect(fingerprintDistance(a, null)).toBe(Infinity);
    expect(fingerprintDistance(a, fp(1).slice(0, 10))).toBe(Infinity);
  });

  it('matches within the threshold and refuses one local change above it', () => {
    // Calibration: the same banner across sizes stayed within 20.1 per cell;
    // different banners and word-sized edits were 159+ apart.
    const resized = fp(100);
    resized[0] = 100 + 20;
    expect(fingerprintsMatch(fp(100), resized)).toBe(true);
    const edited = fp(100);
    edited[0] = 100 + FINGERPRINT_THRESHOLD + 1;
    expect(fingerprintsMatch(fp(100), edited)).toBe(false);
    expect(fingerprintsMatch(fp(100), null)).toBe(false);
  });

  it('round-trips through base64 and refuses malformed input', () => {
    const cells = Uint8Array.from({ length: FINGERPRINT_LENGTH }, (_, i) => i % 256);
    expect(decodeFingerprint(encodeFingerprint(cells))).toEqual(cells);
    expect(decodeFingerprint('not base64!')).toBeNull();
    expect(decodeFingerprint(btoa('too short'))).toBeNull();
    expect(decodeFingerprint(undefined)).toBeNull();
    expect(decodeFingerprint(123)).toBeNull();
  });

  it('distinguishes color variants with identical luminance', () => {
    const pixels = (color: number[]) => {
      const rgba = new Uint8ClampedArray(FINGERPRINT_WIDTH * FINGERPRINT_HEIGHT * 4);
      for (let i = 0; i < rgba.length; i += 4) rgba.set([...color, 255], i);
      return fingerprintFromPixels(rgba, FINGERPRINT_WIDTH, FINGERPRINT_HEIGHT);
    };
    const red = pixels([255, 0, 0]);
    const green = pixels([0, 130, 0]);
    expect(red[0]).toBe(green[0]);
    expect(fingerprintsMatch(red, green)).toBe(false);
  });

  it('keeps legacy fingerprints readable but never uses them as verified matches', () => {
    const legacy = new Uint8Array(FINGERPRINT_WIDTH * FINGERPRINT_HEIGHT).fill(100);
    const encoded = encodeFingerprint(legacy);
    expect(decodeFingerprint(encoded)).toEqual(legacy);
    expect(isCurrentFingerprint(encoded)).toBe(false);
    expect(isCurrentFingerprint(encodeFingerprint(fp(100)))).toBe(true);
    expect(fingerprintsMatch(legacy, legacy)).toBe(false);
    expect(fingerprintsMatch(legacy, fp(100))).toBe(false);
  });
});
