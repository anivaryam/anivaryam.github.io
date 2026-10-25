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
  fingerprintsMatch,
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
});
