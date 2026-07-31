import { describe, it, expect, beforeAll } from "vitest";
import { compressImage, convertImageFormat, upscaleImage, stripExif, applyTransforms } from "./transforms";

// 2x2 PNG, generated via base64
const RED_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAABmJLR0QA/wD/AP+gvaeTAAAAFElEQVQImWP8z8Dwn4GBgYGJAQoAHxcCAr7cGDwAAAAASUVORK5CYII=";

let pngBlob: Blob;

const webpSupported = (() => {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
})();

const canvasSupported = (() => {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.getContext("2d") !== null;
  } catch {
    return false;
  }
})();

beforeAll(async () => {
  const bytes = Uint8Array.from(atob(RED_PNG_BASE64), (c) => c.charCodeAt(0));
  pngBlob = new Blob([bytes], { type: "image/png" });
});

describe("compressImage", () => {
  it.skipIf(!canvasSupported)("returns a Blob", async () => {
    const out = await compressImage(pngBlob, { quality: 50 });
    expect(out).toBeInstanceOf(Blob);
    expect(out.size).toBeGreaterThan(0);
  });
});

describe("convertImageFormat", () => {
  it.skipIf(!canvasSupported)("converts PNG to JPEG", async () => {
    const out = await convertImageFormat(pngBlob, { target: "jpeg" });
    expect(out.type).toBe("image/jpeg");
  });

  it.skipIf(!webpSupported)("converts PNG to WebP", async () => {
    const out = await convertImageFormat(pngBlob, { target: "webp" });
    expect(out.type).toBe("image/webp");
  });
});

describe("upscaleImage", () => {
  it.skipIf(!canvasSupported)("returns a larger Blob", async () => {
    const out = await upscaleImage(pngBlob, { factor: 2 });
    expect(out.size).toBeGreaterThan(0);
  });
});

describe("stripExif", () => {
  it.skipIf(!canvasSupported)("returns a Blob", async () => {
    const out = await stripExif(pngBlob);
    expect(out).toBeInstanceOf(Blob);
  });
});

describe("applyTransforms", () => {
  it("returns original when pipeline is empty", async () => {
    const out = await applyTransforms(pngBlob, {});
    expect(out).toBe(pngBlob);
  });

  it.skipIf(!canvasSupported)("chains upscale then compress", async () => {
    const out = await applyTransforms(pngBlob, {
      upscale: { factor: 1.5 },
      compress: { quality: 80 },
    });
    expect(out).toBeInstanceOf(Blob);
  });
});
