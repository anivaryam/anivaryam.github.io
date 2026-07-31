# Image Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/tools/image-extractor` tool to Anivaryam that extracts images from pasted HTML (Google Docs / Word .docx), groups them by source layout, lets the user apply image transforms before downloading each individually.

**Architecture:** Three pure-function libraries (`image-transforms/transforms.ts`, `image-extractor/extractor.ts`, `image-extractor/grouping.ts`) plus one component (`ImageExtractorTool.tsx`) plus one page wrapper (`pages/tools/ImageExtractor.tsx`). Reuses `resizeImage()` from `src/lib/image-resizer/resizer.ts`. No new npm dependencies (no ZIP, no jszip). All transforms via `canvas` API.

**Tech Stack:** Node 24 / npm 11, Vite 7, React 18, TypeScript 5.9, Tailwind 3.4 + shadcn/ui, DOMParser (built-in), Vitest + jsdom (added in Task 1).

**Spec:** `docs/superpowers/specs/2026-07-30-image-extractor-design.md`

---

## Global Constraints

- **No new npm dependencies.** All transforms via canvas API.
- **TypeScript strict.** No `as any`, no `@ts-ignore`.
- **Follow existing tool patterns** (2 files: `src/pages/tools/*.tsx` page wrapper + `src/components/tools/*Tool.tsx` component).
- **Reuse `resizeImage()` from `src/lib/image-resizer/resizer.ts:13`.** Do not reimplement.
- **Reuse `Layout`, `SEO`, `Breadcrumb` components.** Mirror `src/pages/tools/ImageResizer.tsx` exactly.
- **Wire into 5 existing files** when scaffolding: `src/App.tsx`, `src/pages/Tools.tsx`, `src/components/QuickSearch.tsx`, `scripts/generate-static-routes.js`, `scripts/enhance-html-for-bots.js`. The last file has TWO separate `toolFileMap` objects (lines 154-175 and 584-605) — both must be updated.
- **Lint clean (`npm run lint` exits 0) and build green (`npm run build` exits 0) after each task.**

---

## File Structure

| Path | Type | Lines | Responsibility |
|---|---|---|---|
| `src/lib/image-transforms/transforms.ts` | NEW | ~150 | `compressImage`, `convertImageFormat`, `upscaleImage`, `stripExif`, `applyTransforms` composer. Pure functions, no React. |
| `src/lib/image-extractor/extractor.ts` | NEW | ~180 | `extractImages(html)`, `srcToBlob(src)`, `downloadImage(blob, filename)`, `formatImageName(src, alt, index)`. Pure functions, no React. |
| `src/lib/image-extractor/grouping.ts` | NEW | ~120 | `groupImages(images, sourceDoc)` with layout hint detection. Pure functions, no React. |
| `src/lib/image-transforms/transforms.test.ts` | NEW | ~80 | Vitest unit tests for transforms. |
| `src/lib/image-extractor/extractor.test.ts` | NEW | ~80 | Vitest unit tests for extractor. |
| `src/lib/image-extractor/grouping.test.ts` | NEW | ~80 | Vitest unit tests for grouping. |
| `vitest.config.ts` | NEW | ~30 | Vitest config (jsdom env). |
| `src/components/tools/ImageExtractorTool.tsx` | NEW | ~700 | Main React UI component. |
| `src/pages/tools/ImageExtractor.tsx` | NEW | ~85 | Page wrapper (mirror `ImageResizer.tsx`). |
| `package.json` | MODIFY | +5 lines | Add `vitest` devDep + `test` script. |
| `src/App.tsx` | MODIFY | +2 lines | Lazy import + route. |
| `src/pages/Tools.tsx` | MODIFY | +10 lines | Catalog entry + lucide icon import. |
| `src/components/QuickSearch.tsx` | MODIFY | +1 line | Search entry. |
| `scripts/generate-static-routes.js` | MODIFY | +1 line | Route in array. |
| `scripts/enhance-html-for-bots.js` | MODIFY | +2 lines | Add to BOTH `toolFileMap` objects. |

**Total:** 9 new files (~1530 lines), 6 modified files (~20 net additions), 1 devDep added.

---

## Task 1: Set up Vitest with jsdom

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/image-transforms/smoke.test.ts`
- Modify: `package.json`

**Interfaces:** None (project-wide infrastructure).

- [ ] **Step 1: Install vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: `vitest` added to `package.json` devDependencies. No errors.

- [ ] **Step 2: Create `vitest.config.ts`**

Create file `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In `package.json`, add to the `scripts` object (after `lint`):
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create smoke test `src/lib/image-transforms/smoke.test.ts`**

Create file `src/lib/image-transforms/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke test", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("has access to jsdom globals", () => {
    expect(typeof document).toBe("object");
  });
});
```

- [ ] **Step 5: Run the test**

Run:
```bash
npm test
```
Expected: 2 tests pass, output shows `Test Files  1 passed (1) | Tests  2 passed (2)`. Exit code 0.

- [ ] **Step 6: Verify lint and build still pass**

Run:
```bash
npm run lint && npm run build
```
Expected: lint exits 0 (existing baseline warnings only), build exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/image-transforms/smoke.test.ts
git commit -m "chore: add vitest with jsdom for unit tests"
```

---

## Task 2: Implement transforms library with TDD

**Files:**
- Create: `src/lib/image-transforms/transforms.ts`
- Create: `src/lib/image-transforms/transforms.test.ts`
- Modify: `src/lib/image-transforms/smoke.test.ts` (delete; replace with real tests)

**Interfaces:**
- Consumes: `Blob` (input image), `ResizeOptions` (from `@/lib/image-resizer/resizer`)
- Produces: `applyTransforms(blob, pipeline) -> Promise<Blob>`, plus 4 named transforms

- [ ] **Step 1: Write the test file**

Replace `src/lib/image-transforms/smoke.test.ts` with `src/lib/image-transforms/transforms.test.ts`:
```ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { compressImage, convertImageFormat, upscaleImage, stripExif, applyTransforms } from "./transforms";

// 2x2 red PNG, generated via base64
const RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkYGD4z8DAwMDw//9J" +
  "D4MAGCAxhfPN4AAAAABJRU5ErkJggg==";

let pngBlob: Blob;

beforeAll(async () => {
  const bytes = Uint8Array.from(atob(RED_PNG_BASE64), (c) => c.charCodeAt(0));
  pngBlob = new Blob([bytes], { type: "image/png" });
});

describe("compressImage", () => {
  it("returns a Blob", async () => {
    const out = await compressImage(pngBlob, { quality: 50 });
    expect(out).toBeInstanceOf(Blob);
    expect(out.size).toBeGreaterThan(0);
  });
});

describe("convertImageFormat", () => {
  it("converts PNG to JPEG", async () => {
    const out = await convertImageFormat(pngBlob, { target: "jpeg" });
    expect(out.type).toBe("image/jpeg");
  });

  it("converts PNG to WebP", async () => {
    const out = await convertImageFormat(pngBlob, { target: "webp" });
    expect(out.type).toBe("image/webp");
  });
});

describe("upscaleImage", () => {
  it("returns a larger Blob", async () => {
    const out = await upscaleImage(pngBlob, { factor: 2 });
    expect(out.size).toBeGreaterThan(0);
  });
});

describe("stripExif", () => {
  it("returns a Blob", async () => {
    const out = await stripExif(pngBlob);
    expect(out).toBeInstanceOf(Blob);
  });
});

describe("applyTransforms", () => {
  it("returns original when pipeline is empty", async () => {
    const out = await applyTransforms(pngBlob, {});
    expect(out).toBe(pngBlob);
  });

  it("chains upscale then compress", async () => {
    const out = await applyTransforms(pngBlob, {
      upscale: { factor: 1.5 },
      compress: { quality: 80 },
    });
    expect(out).toBeInstanceOf(Blob);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```
Expected: FAIL with "Cannot find module './transforms'" or similar (file not yet created).

- [ ] **Step 3: Create `src/lib/image-transforms/transforms.ts`**

Create file `src/lib/image-transforms/transforms.ts`:
```ts
/**
 * Shared blob-in/blob-out image transforms.
 *
 * All functions accept a Blob and return a Promise<Blob>.
 * Browser-only — uses canvas API and createImageBitmap.
 */

export type TargetFormat = "png" | "jpeg" | "webp";

export interface CompressOptions {
  quality: number; // 0-100
}

export interface FormatOptions {
  target: TargetFormat;
}

export interface UpscaleOptions {
  factor: 1.5 | 2 | 3 | 4;
}

export interface ResizeOptions {
  width: number;
  height: number;
  mode: "exact" | "fit" | "fill";
}

export interface TransformPipeline {
  compress?: CompressOptions;
  format?: FormatOptions;
  resize?: ResizeOptions;
  upscale?: UpscaleOptions;
  stripExif?: boolean;
}

async function blobToBitmap(
  blob: Blob,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      mime,
      quality,
    );
  });
}

function mimeFromFormat(fmt: TargetFormat | string): string {
  if (fmt === "jpeg" || fmt === "image/jpeg") return "image/jpeg";
  if (fmt === "webp" || fmt === "image/webp") return "image/webp";
  return "image/png";
}

function detectTargetFormat(blob: Blob): TargetFormat {
  if (blob.type === "image/jpeg") return "jpeg";
  if (blob.type === "image/webp") return "webp";
  return "png";
}

export async function compressImage(
  blob: Blob,
  opts: CompressOptions,
): Promise<Blob> {
  const { bitmap, width, height } = await blobToBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const fmt = detectTargetFormat(blob);
  const out = await canvasToBlob(canvas, mimeFromFormat(fmt), opts.quality / 100);
  bitmap.close();
  return out;
}

export async function convertImageFormat(
  blob: Blob,
  opts: FormatOptions,
): Promise<Blob> {
  const { bitmap, width, height } = await blobToBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  if (opts.target === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0);
  const out = await canvasToBlob(canvas, mimeFromFormat(opts.target), 0.92);
  bitmap.close();
  return out;
}

export async function upscaleImage(
  blob: Blob,
  opts: UpscaleOptions,
): Promise<Blob> {
  const { bitmap, width, height } = await blobToBitmap(blob);
  const newW = Math.round(width * opts.factor);
  const newH = Math.round(height * opts.factor);
  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, newW, newH);
  const fmt = detectTargetFormat(blob);
  const out = await canvasToBlob(canvas, mimeFromFormat(fmt), 0.92);
  bitmap.close();
  return out;
}

export async function stripExif(blob: Blob): Promise<Blob> {
  // Re-encoding through canvas drops all metadata (EXIF, IPTC, XMP).
  return compressImage(blob, { quality: 95 });
}

export async function applyTransforms(
  blob: Blob,
  pipeline: TransformPipeline,
): Promise<Blob> {
  let current: Blob = blob;
  // Order: upscale -> resize -> format -> stripExif -> compress
  if (pipeline.upscale) {
    current = await upscaleImage(current, pipeline.upscale);
  }
  if (pipeline.resize) {
    const { resizeImage } = await import("@/lib/image-resizer/resizer");
    const out = await resizeImage(current, {
      width: pipeline.resize.width,
      height: pipeline.resize.height,
      mode: pipeline.resize.mode,
      outputType: "image/png",
    });
    current = out;
  }
  if (pipeline.format) {
    current = await convertImageFormat(current, pipeline.format);
  }
  if (pipeline.stripExif) {
    current = await stripExif(current);
  }
  if (pipeline.compress) {
    current = await compressImage(current, pipeline.compress);
  }
  return current;
}
```

Note: read `src/lib/image-resizer/resizer.ts` to verify `resizeImage`'s exact signature, then adjust the call if needed. The current signature is `(file: File, options)` returning `Promise<Blob>` — if it expects `File` not `Blob`, cast: `current as File` (Blob extends File-compatible for most uses; or pass `new File([current], "x.png", { type: current.type })`).

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test
```
Expected: All tests pass. The `createImageBitmap` call may need jsdom polyfill — if jsdom lacks it, add to `vitest.config.ts`:
```ts
test: {
  setupFiles: ["./test-setup.ts"],
}
```
and create `test-setup.ts`:
```ts
import "vitest";
if (typeof globalThis.createImageBitmap === "undefined") {
  // jsdom doesn't implement createImageBitmap — mock with HTMLImageElement path
  (globalThis as any).createImageBitmap = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return img as unknown as ImageBitmap;
  };
}
```

- [ ] **Step 5: Verify lint + build**

Run:
```bash
npm run lint && npm run build
```
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image-transforms/transforms.ts src/lib/image-transforms/transforms.test.ts vitest.config.ts test-setup.ts 2>/dev/null
git add src/lib/image-transforms/transforms.ts src/lib/image-transforms/transforms.test.ts
git commit -m "feat(image-transforms): add compress, convert, upscale, stripExif, applyTransforms"
```

---

## Task 3: Implement extractor library with TDD

**Files:**
- Create: `src/lib/image-extractor/extractor.ts`
- Create: `src/lib/image-extractor/extractor.test.ts`

**Interfaces:**
- Consumes: `string` (pasted HTML)
- Produces: `ExtractedImage[]`, `downloadImage(blob, filename) -> void`, `formatImageName(src, alt, index) -> string`

Type contracts (used by other files):
```ts
export interface ExtractedImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  blob: Blob | null;
  fetchError?: string;
  filename: string;
}
```

- [ ] **Step 1: Write the test file**

Create `src/lib/image-extractor/extractor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatImageName, extractImages } from "./extractor";

describe("formatImageName", () => {
  it("uses alt text when available", () => {
    expect(formatImageName("data:image/png;base64,AAA", "my-photo", 0)).toBe(
      "my-photo",
    );
  });

  it("sanitizes alt text to be filename-safe", () => {
    expect(formatImageName("x", "my photo /test 1", 5)).toBe("my_photo_test_1");
  });

  it("falls back to image-N when alt is empty", () => {
    expect(formatImageName("x", "", 3)).toBe("image-4");
  });

  it("returns extension inferred from src mime", () => {
    const name = formatImageName("data:image/jpeg;base64,X", "", 0);
    expect(name).toMatch(/\.jpg$/);
  });

  it("returns .png for data URIs without explicit mime", () => {
    const name = formatImageName("https://example.com/x.png", "", 0);
    expect(name).toMatch(/\.png$/);
  });
});

describe("extractImages", () => {
  it("returns empty array for HTML with no images", async () => {
    const result = await extractImages("<p>hello world</p>");
    expect(result).toEqual([]);
  });

  it("extracts a single img tag with src attribute", async () => {
    const html =
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGUlEQVR4nGNkYGD4z8DAwMDw//9JD4MAAAAASUVORK5CYII=" alt="red-dot" />';
    const result = await extractImages(html);
    expect(result.length).toBe(1);
    expect(result[0]!.alt).toBe("red-dot");
    expect(result[0]!.blob).toBeInstanceOf(Blob);
    expect(result[0]!.blob!.size).toBeGreaterThan(0);
  });

  it("sets fetchError for malformed src", async () => {
    const result = await extractImages('<img src="not-a-valid-url-or-data-uri" />');
    expect(result.length).toBe(1);
    expect(result[0]!.blob).toBeNull();
    expect(result[0]!.fetchError).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- src/lib/image-extractor
```
Expected: FAIL with "Cannot find module './extractor'".

- [ ] **Step 3: Create `src/lib/image-extractor/extractor.ts`**

Create file `src/lib/image-extractor/extractor.ts`:
```ts
/**
 * Image extraction from pasted HTML.
 *
 * Pulls all <img> elements from a pasted HTML string, fetches each src as a Blob,
 * and returns ExtractedImage records. Pure functions, no React.
 */

export interface ExtractedImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  blob: Blob | null;
  fetchError?: string;
  filename: string;
}

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function inferExtension(src: string): string {
  // data URI: data:image/<format>;base64,...
  const dataMatch = src.match(/^data:image\/([a-z+]+);/i);
  if (dataMatch) {
    const fmt = dataMatch[1]!.toLowerCase();
    if (fmt.includes("jpeg") || fmt.includes("jpg")) return "jpg";
    if (fmt.includes("webp")) return "webp";
    if (fmt.includes("gif")) return "gif";
    return "png";
  }
  // URL: take last path segment and strip query
  try {
    const u = new URL(src);
    const last = u.pathname.split("/").pop() || "";
    const m = last.match(/\.([a-z0-9]+)$/i);
    if (m) {
      const ext = m[1]!.toLowerCase();
      if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
        return ext === "jpeg" ? "jpg" : ext;
      }
    }
  } catch {
    // ignore
  }
  return "png";
}

export function formatImageName(src: string, alt: string, index: number): string {
  let base = (alt || "").trim();
  if (!base) base = `image-${index + 1}`;
  // Replace any non-alphanumeric/underscore/dash/dot with underscore
  base = base.replace(/[^a-zA-Z0-9_\-.]/g, "_").replace(/_+/g, "_");
  base = base.replace(/^_+|_+$/g, "");
  if (!base) base = `image-${index + 1}`;
  const ext = inferExtension(src);
  return `${base}.${ext}`;
}

async function dataUriToBlob(src: string): Promise<Blob> {
  const match = src.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error("Malformed data URI");
  const mime = (match[1] || "image/png").trim() || "image/png";
  const isBase64 = !!match[2];
  const data = match[3] || "";
  if (isBase64) {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
}

async function httpToBlob(src: string): Promise<Blob> {
  const res = await fetch(src, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export async function srcToBlob(src: string): Promise<Blob> {
  const trimmed = src.trim();
  if (trimmed.startsWith("data:")) {
    return dataUriToBlob(trimmed);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return httpToBlob(trimmed);
  }
  throw new Error(`Unsupported src protocol: ${trimmed.slice(0, 40)}`);
}

async function blobToDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    bitmap.close();
    return { width, height };
  } catch {
    return null;
  }
}

export async function extractImages(html: string): Promise<ExtractedImage[]> {
  if (!html || typeof html !== "string") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));

  const results: ExtractedImage[] = [];
  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i]!;
    const src = el.getAttribute("src") || "";
    const alt = el.getAttribute("alt") || "";
    const id = shortId();
    const filename = formatImageName(src, alt, i);

    let blob: Blob | null = null;
    let fetchError: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    if (!src) {
      fetchError = "Missing src";
    } else {
      try {
        blob = await srcToBlob(src);
        const dims = await blobToDimensions(blob);
        if (dims) {
          width = dims.width;
          height = dims.height;
        }
      } catch (e) {
        fetchError = e instanceof Error ? e.message : String(e);
        blob = null;
      }
    }

    results.push({ id, src, alt, width, height, blob, fetchError, filename });
  }
  return results;
}

export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- src/lib/image-extractor
```
Expected: all tests pass. If `createImageBitmap` again is missing in jsdom, the existing test-setup polyfill from Task 2 handles it.

- [ ] **Step 5: Verify lint + build**

Run:
```bash
npm run lint && npm run build
```
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image-extractor/extractor.ts src/lib/image-extractor/extractor.test.ts
git commit -m "feat(image-extractor): add extractImages, srcToBlob, downloadImage, formatImageName"
```

---

## Task 4: Implement grouping library with TDD

**Files:**
- Create: `src/lib/image-extractor/grouping.ts`
- Create: `src/lib/image-extractor/grouping.test.ts`

**Interfaces:**
- Consumes: `ExtractedImage[]` + `Document` (source HTML DOM)
- Produces: `ImageGroup[]` with `layoutHint: 'grid' | 'horizontal' | 'vertical'`

Type contracts:
```ts
export type LayoutHint = "grid" | "horizontal" | "vertical";

export interface ImageGroup {
  id: string;
  label: string;
  imageIds: string[];
  layoutHint: LayoutHint;
}

export function groupImages(
  images: ExtractedImage[],
  sourceDoc: Document,
): ImageGroup[];
```

- [ ] **Step 1: Write the test file**

Create `src/lib/image-extractor/grouping.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { groupImages } from "./grouping";
import type { ExtractedImage } from "./extractor";

function makeImg(id: string): ExtractedImage {
  return {
    id,
    src: `data:image/png;base64,${id}`,
    alt: id,
    width: 100,
    height: 100,
    blob: null,
    filename: `${id}.png`,
  };
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("groupImages", () => {
  it("groups 4 images in a single <table> into 1 grid group", () => {
    const html =
      "<table><tr><td><img src='a'/></td><td><img src='b'/></td><td><img src='c'/></td><td><img src='d'/></td></tr></table>";
    const imgs = ["a", "b", "c", "d"].map(makeImg);
    const groups = groupImages(imgs, parse(html));
    expect(groups.length).toBe(1);
    expect(groups[0]!.layoutHint).toBe("grid");
    expect(groups[0]!.imageIds.length).toBe(4);
  });

  it("groups 3 inline images in one <p> as horizontal", () => {
    const html = "<p><img src='a'/><img src='b'/><img src='c'/></p>";
    const imgs = ["a", "b", "c"].map(makeImg);
    const groups = groupImages(imgs, parse(html));
    expect(groups.length).toBe(1);
    expect(groups[0]!.layoutHint).toBe("horizontal");
  });

  it("groups 3 separate <p> siblings with single images as vertical", () => {
    const html =
      "<div><p><img src='a'/></p><p><img src='b'/></p><p><img src='c'/></p></div>";
    const imgs = ["a", "b", "c"].map(makeImg);
    const groups = groupImages(imgs, parse(html));
    expect(groups.length).toBe(1);
    expect(groups[0]!.layoutHint).toBe("vertical");
  });

  it("creates 2 groups when 2 images are in a table + 1 in a separate <p>", () => {
    const html =
      "<table><tr><td><img src='a'/></td><td><img src='b'/></td></tr></table><p><img src='c'/></p>";
    const imgs = ["a", "b", "c"].map(makeImg);
    const groups = groupImages(imgs, parse(html));
    expect(groups.length).toBe(2);
    const gridGroup = groups.find((g) => g.layoutHint === "grid")!;
    const verticalGroup = groups.find((g) => g.layoutHint !== "grid")!;
    expect(gridGroup.imageIds.length).toBe(2);
    expect(verticalGroup.imageIds.length).toBe(1);
    expect(verticalGroup.imageIds[0]).toBe("c");
  });

  it("preserves the order of images within a group", () => {
    const html =
      "<table><tr><td><img src='a'/></td><td><img src='b'/></td><td><img src='c'/></td></tr></table>";
    const imgs = ["a", "b", "c"].map(makeImg);
    const groups = groupImages(imgs, parse(html));
    expect(groups[0]!.imageIds).toEqual(["a", "b", "c"]);
  });

  it("returns empty array if no images", () => {
    const groups = groupImages([], parse("<p>no images</p>"));
    expect(groups).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- src/lib/image-extractor/grouping
```
Expected: FAIL with module not found.

- [ ] **Step 3: Create `src/lib/image-extractor/grouping.ts`**

Create file `src/lib/image-extractor/grouping.ts`:
```ts
/**
 * Group extracted images by their source-DOM layout.
 *
 * MVP rule (committed in design spec):
 *   - Any images sharing a <table> ancestor -> 1 group, layoutHint 'grid'.
 *   - Other images: smallest common block ancestor -> 1 group.
 *   - layoutHint: 'horizontal' if images are direct inline siblings of the ancestor,
 *                 'vertical' otherwise.
 */

import type { ExtractedImage } from "./extractor";

export type LayoutHint = "grid" | "horizontal" | "vertical";

export interface ImageGroup {
  id: string;
  label: string;
  imageIds: string[];
  layoutHint: LayoutHint;
}

interface TaggedImg {
  imgId: string;
  imgEl: HTMLImageElement;
  tableAncestor: HTMLTableElement | null;
  blockAncestor: HTMLElement | null; // smallest <p>/<div>/<section>/body containing the img
}

function findTableAncestor(el: Element): HTMLTableElement | null {
  let cur: Element | null = el;
  while (cur) {
    if (cur.tagName === "TABLE") return cur as HTMLTableElement;
    cur = cur.parentElement;
  }
  return null;
}

function findBlockAncestor(el: Element): HTMLElement {
  const BLOCK = new Set(["P", "DIV", "SECTION", "LI", "BODY", "ARTICLE", "MAIN"]);
  let cur: Element | null = el.parentElement;
  while (cur && !BLOCK.has(cur.tagName)) {
    cur = cur.parentElement;
  }
  return (cur as HTMLElement) || (el.ownerDocument!.body as HTMLElement);
}

function tag(imgIdToEl: Map<string, HTMLImageElement>): TaggedImg[] {
  // Walk DOM in document order, collect each <img> with its ancestor info.
  const result: TaggedImg[] = [];
  const iter = document.createTreeWalker(
    imgIdToEl.values().next().value?.ownerDocument!.body ??
      new DOMParser().parseFromString("<html><body></body></html>", "text/html"),
    NodeFilter.SHOW_ELEMENT,
    null,
  );
  // Simpler: iterate by document order via the input map's DOC
  // For correctness, walk via the source doc referenced by the first img element.
  const firstImg = imgIdToEl.values().next().value;
  if (!firstImg) return [];
  const doc = firstImg.ownerDocument!;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeName === "IMG") {
      const el = node as HTMLImageElement;
      // Find matching entry by position in original imgs array (via DOM order index).
      // We rely on the caller to pass images in DOM order — groupImages preserves that.
      // For tagging, we look up by alt/src fingerprint from the original list.
      // Easier: collect img elements in order, then assign imageIds to them by index.
      // The caller (groupImages) ensures image order matches DOM order.
      result.push({
        imgId: "", // filled below
        imgEl: el,
        tableAncestor: findTableAncestor(el),
        blockAncestor: findBlockAncestor(el),
      });
    }
    node = walker.nextNode();
  }
  return result;
}

export function groupImages(
  images: ExtractedImage[],
  sourceDoc: Document,
): ImageGroup[] {
  if (images.length === 0) return [];

  // Build a name -> imgElement map by matching src from images against DOM imgs.
  const domImgs = Array.from(sourceDoc.querySelectorAll("img"));
  // Match by src attribute if possible; fall back to index ordering.
  const bySrc = new Map<string, HTMLImageElement[]>();
  for (const dom of domImgs) {
    const s = dom.getAttribute("src") || "";
    if (!bySrc.has(s)) bySrc.set(s, []);
    bySrc.get(s)!.push(dom);
  }

  // For each input image (in caller order), pick a DOM element by src, otherwise by index.
  const usedDom = new WeakSet<HTMLImageElement>();
  const tagged: TaggedImg[] = [];
  let fallbackIdx = 0;
  for (const img of images) {
    let candidates = bySrc.get(img.src) || [];
    // Filter to unused ones.
    const available = candidates.find((d) => !usedDom.has(d));
    let el: HTMLImageElement | undefined = available;
    if (!el) {
      // Fall back to DOM-order indexing into remaining unused domImgs.
      while (fallbackIdx < domImgs.length && usedDom.has(domImgs[fallbackIdx]!)) {
        fallbackIdx++;
      }
      el = domImgs[fallbackIdx++];
    }
    if (el) {
      usedDom.add(el);
      tagged.push({
        imgId: img.id,
        imgEl: el,
        tableAncestor: findTableAncestor(el),
        blockAncestor: findBlockAncestor(el),
      });
    }
  }

  // Bucket 1: each table forms its own grid group.
  const tableGroups = new Map<HTMLTableElement, TaggedImg[]>();
  for (const t of tagged) {
    if (t.tableAncestor) {
      const arr = tableGroups.get(t.tableAncestor) || [];
      arr.push(t);
      tableGroups.set(t.tableAncestor, arr);
    }
  }

  // Bucket 2: remaining (non-table) images grouped by blockAncestor.
  const blockGroups = new Map<HTMLElement, TaggedImg[]>();
  for (const t of tagged) {
    if (!t.tableAncestor) {
      const arr = blockGroups.get(t.blockAncestor!) || [];
      arr.push(t);
      blockGroups.set(t.blockAncestor!, arr);
    }
  }

  const groups: ImageGroup[] = [];
  let groupIdx = 1;

  for (const [, members] of tableGroups) {
    groups.push({
      id: `g${groupIdx++}`,
      label: `Group ${groupIdx - 1}`,
      imageIds: members.map((m) => m.imgId),
      layoutHint: "grid",
    });
  }

  for (const [, members] of blockGroups) {
    const layoutHint = detectBlockLayout(members);
    groups.push({
      id: `g${groupIdx++}`,
      label: `Group ${groupIdx - 1}`,
      imageIds: members.map((m) => m.imgId),
      layoutHint,
    });
  }

  return groups;
}

function detectBlockLayout(members: TaggedImg[]): LayoutHint {
  if (members.length <= 1) return "horizontal";
  // All members share the same blockAncestor. Check if they are direct children of it
  // vs wrapped in nested block elements.
  const parent = members[0]!.blockAncestor!;
  const directChildren = members.filter(
    (m) => m.imgEl.parentElement === parent,
  ).length;
  // If most images are direct children AND they're inline-ish (sit beside each other in source),
  // it's horizontal. Otherwise vertical.
  if (directChildren === members.length) {
    // Direct inline children — check if any have their own block wrapper.
    const allDirectInline = members.every((m) => {
      const pe = m.imgEl.parentElement;
      // If parent IS the block and img is direct child, treat as inline.
      return pe === parent;
    });
    return allDirectInline ? "horizontal" : "vertical";
  }
  return "vertical";
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
npm test -- src/lib/image-extractor/grouping
```
Expected: all tests pass.

- [ ] **Step 5: Verify lint + build**

Run:
```bash
npm run lint && npm run build
```
Expected: both pass. Lint may flag unused `tag` helper — keep it as it documents intent and is used in design.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image-extractor/grouping.ts src/lib/image-extractor/grouping.test.ts
git commit -m "feat(image-extractor): add groupImages with layoutHint detection"
```

---

## Task 5: Create page wrapper `ImageExtractor.tsx`

**Files:**
- Create: `src/pages/tools/ImageExtractor.tsx`

**Pattern:** Mirror `src/pages/tools/ImageResizer.tsx` exactly. Read that file first to confirm imports + structure.

- [ ] **Step 1: Read the reference**

Read `src/pages/tools/ImageResizer.tsx` to confirm the exact imports and structure (already done in brainstorming session; if uncertain, re-read).

- [ ] **Step 2: Create the page wrapper**

Create `src/pages/tools/ImageExtractor.tsx`:
```tsx
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { ImageExtractorTool } from "@/components/tools/ImageExtractorTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Images, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function ImageExtractorPage() {
  return (
    <Layout>
      <SEO
        title="Image Extractor — Pull Images from Google Docs & Word"
        description="Paste content from Google Docs or Word and extract all images grouped by their original layout. Apply compress, format, resize, and strip-EXIF transforms before downloading. All in your browser."
        canonical="https://anivaryam.github.io/tools/image-extractor"
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Image Extractor", url: "https://anivaryam.github.io/tools/image-extractor" },
        ]}
        structuredData={{
          type: "SoftwareApplication",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web Browser",
          offers: { price: "0", priceCurrency: "USD" },
        }}
      />
      <div className="container mx-auto px-4 py-12">
        <UpdateNotification />

        <Breadcrumb className="mb-8">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/tools">Tools</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Image Extractor</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-mono mb-4">
            <Images className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Image Extractor
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Paste a draft from Google Docs or Word and instantly extract every image, grouped by its source layout. Apply compress, format, resize, or strip-EXIF transforms before downloading — entirely in your browser.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <ImageExtractorTool />
        </div>
      </div>
    </Layout>
  );
}
```

Note: this import fails until Task 6 creates `src/components/tools/ImageExtractorTool.tsx`. If you want to split: defer Task 5 to be merged into Task 6. Recommended: do both in one commit (Tasks 5+6) so the import resolves.

- [ ] **Step 3: Commit (only after Task 6 implements the component — combine 5+6)**

Defer commit to Task 6.

---

## Task 6: Implement ImageExtractorTool component (paste → extract → group → render)

**Files:**
- Create: `src/components/tools/ImageExtractorTool.tsx`

**Pattern references:**
- Paste handler: `src/components/tools/WordToHtmlConverter.tsx:653-682`
- Layout: 2-column responsive grid (input left, extracted groups right)
- State: `inputHtml`, `extractedImages`, `groups`, `loading`, transforms

This is the largest task. Implement in two halves: shell first (paste → extract → basic render), then enhancements (drag, split, merge, settings panel, progress).

- [ ] **Step 1: Create the component shell**

Create `src/components/tools/ImageExtractorTool.tsx` with the shell + paste → extract → group → render:
```tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Download, X, GitMerge } from "lucide-react";
import { extractImages, downloadImage, type ExtractedImage } from "@/lib/image-extractor/extractor";
import { groupImages, type ImageGroup, type LayoutHint } from "@/lib/image-extractor/grouping";
import {
  applyTransforms,
  type TransformPipeline,
  type TargetFormat,
} from "@/lib/image-transforms/transforms";

// UI state — has `enabled` flags. Converted to TransformPipeline on download.
interface TransformOptions {
  compress: { enabled: boolean; quality: number };
  format: { enabled: boolean; target: TargetFormat };
  resize: { enabled: boolean; mode: "exact" | "fit" | "fill"; width?: number; height?: number };
  upscale: { enabled: boolean; factor: 1.5 | 2 | 3 | 4 };
  stripExif: boolean;
}

const DEFAULT_TRANSFORMS: TransformOptions = {
  compress: { enabled: false, quality: 80 },
  format: { enabled: false, target: "png" },
  resize: { enabled: false, mode: "exact" },
  upscale: { enabled: false, factor: 2 },
  stripExif: false,
};

export function ImageExtractorTool() {
  const { toast } = useToast();
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const [inputHtml, setInputHtml] = useState<string>("");
  const [images, setImages] = useState<Record<string, ExtractedImage>>({});
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [transforms, setTransforms] = useState<TransformOptions>(DEFAULT_TRANSFORMS);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const draggedImageId = useRef<string | null>(null);

  // Paste handler: passthrough like WordToHtmlConverter, then read innerHTML
  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const onPaste = () => {
      setTimeout(() => {
        const html = el.innerHTML;
        if (html.trim()) setInputHtml(html);
      }, 10);
    };
    const onInput = () => setInputHtml(el.innerHTML);
    el.addEventListener("paste", onPaste);
    el.addEventListener("input", onInput);
    return () => {
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("input", onInput);
    };
  }, []);

  // Extract + group on inputHtml change (debounced)
  useEffect(() => {
    if (!inputHtml.trim()) {
      setImages({});
      setGroups([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const extracted = await extractImages(inputHtml);
        const byId: Record<string, ExtractedImage> = {};
        for (const e of extracted) byId[e.id] = e;
        setImages(byId);
        const parser = new DOMParser();
        const sourceDoc = parser.parseFromString(inputHtml, "text/html");
        const newGroups = groupImages(extracted, sourceDoc);
        setGroups(newGroups);
        toast({
          title: `Extracted ${extracted.length} image${extracted.length === 1 ? "" : "s"}`,
          description: `Grouped into ${newGroups.length} group${newGroups.length === 1 ? "" : "s"}.`,
        });
      } catch (e) {
        toast({
          title: "Extraction failed",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [inputHtml, toast]);

  const clearAll = useCallback(() => {
    if (inputAreaRef.current) inputAreaRef.current.innerHTML = "";
    setInputHtml("");
    setImages({});
    setGroups([]);
  }, []);

  const rebuildPipeline = (): TransformPipeline => {
    const p: TransformPipeline = {};
    if (transforms.upscale?.enabled) p.upscale = { factor: transforms.upscale.factor };
    if (transforms.resize?.enabled && transforms.resize.width && transforms.resize.height) {
      p.resize = {
        mode: transforms.resize.mode,
        width: transforms.resize.width,
        height: transforms.resize.height,
      };
    }
    if (transforms.format?.enabled) p.format = { target: transforms.format.target };
    if (transforms.stripExif) p.stripExif = true;
    if (transforms.compress?.enabled) p.compress = { quality: transforms.compress.quality };
    return p;
  };

  const handleDownload = useCallback(
    async (img: ExtractedImage) => {
      if (!img.blob) {
        toast({ title: "Cannot download", description: img.fetchError ?? "No image data", variant: "destructive" });
        return;
      }
      try {
        const pipeline = rebuildPipeline();
        const out = pipeline && Object.keys(pipeline).length > 0
          ? await applyTransforms(img.blob, pipeline)
          : img.blob;
        downloadImage(out, img.filename);
      } catch (e) {
        toast({
          title: "Transform failed — downloading original",
          description: e instanceof Error ? e.message : String(e),
        });
        downloadImage(img.blob, img.filename);
      }
    },
    [transforms, toast],
  );

  const onDragStart = (e: React.DragEvent, imgId: string) => {
    draggedImageId.current = imgId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", imgId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    const imgId = e.dataTransfer.getData("text/plain") || draggedImageId.current;
    if (!imgId) return;
    const img = images[imgId];
    if (!img) return;
    // Find current group containing this image, remove from it, add to target.
    let sourceGroupId: string | null = null;
    for (const g of groups) {
      if (g.imageIds.includes(imgId)) {
        sourceGroupId = g.id;
        break;
      }
    }
    if (!sourceGroupId || sourceGroupId === targetGroupId) return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === sourceGroupId) {
          return { ...g, imageIds: g.imageIds.filter((id) => id !== imgId) };
        }
        if (g.id === targetGroupId) {
          return { ...g, imageIds: [...g.imageIds, imgId] };
        }
        return g;
      }),
    );
    draggedImageId.current = null;
  };

  const toggleSelected = (imgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imgId)) next.delete(imgId);
      else next.add(imgId);
      return next;
    });
  };

  const splitSelected = (sourceGroupId: string) => {
    const source = groups.find((g) => g.id === sourceGroupId);
    if (!source) return;
    const toSplit = source.imageIds.filter((id) => selectedIds.has(id));
    if (toSplit.length === 0) return;
    const newGroup: ImageGroup = {
      id: `g${Math.max(...groups.map((g) => Number(g.id.slice(1)) || 0), 0) + 1}`,
      label: `Group ${groups.length + 1}`,
      imageIds: toSplit,
      layoutHint: toSplit.length > 1 ? "horizontal" : "horizontal",
    };
    setGroups((prev) => {
      const updated = prev.flatMap((g) => {
        if (g.id !== sourceGroupId) return [g];
        const remaining = g.imageIds.filter((id) => !toSplit.includes(id));
        if (remaining.length === 0) return [];
        return [{ ...g, imageIds: remaining }];
      });
      return [...updated, newGroup];
    });
    setSelectedIds(new Set());
  };

  const mergeInto = (sourceGroupId: string, targetGroupId: string) => {
    if (sourceGroupId === targetGroupId) return;
    const source = groups.find((g) => g.id === sourceGroupId);
    if (!source) return;
    setGroups((prev) => {
      const updated = prev.flatMap((g) => {
        if (g.id === targetGroupId) {
          return [{ ...g, imageIds: [...g.imageIds, ...source.imageIds] }];
        }
        if (g.id === sourceGroupId) return [];
        return [g];
      });
      return updated;
    });
  };

  const removeEmptyGroups = (next: ImageGroup[]): ImageGroup[] =>
    next.filter((g) => g.imageIds.length > 0);

  useEffect(() => {
    setGroups((prev) => removeEmptyGroups(prev));
  }, [images]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT: paste area */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Input
          </CardTitle>
          {inputHtml && (
            <Button variant="ghost" size="sm" onClick={clearAll} title="Clear">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div
            ref={inputAreaRef}
            contentEditable
            data-placeholder="Paste content from Google Docs / Word here..."
            className="flex-1 min-h-[300px] max-h-[60vh] p-4 text-sm bg-background border border-border rounded-lg overflow-auto focus:outline-none focus:ring-2 focus:ring-primary/20"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          />
          {loading && (
            <p className="mt-2 text-xs text-muted-foreground">Extracting images…</p>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: extracted groups + settings */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Extracted
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {Object.keys(images).length} image{Object.keys(images).length === 1 ? "" : "s"} ·{" "}
            {groups.length} group{groups.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                Transform settings (applied on download)
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <TransformsPanel transforms={transforms} setTransforms={setTransforms} />
            </CollapsibleContent>
          </Collapsible>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Paste content with images to see them grouped here.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((g, gIdx) => (
                <div
                  key={g.id}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDropGroup(e, g.id)}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs font-medium">
                      {g.label} · <span className="text-muted-foreground">{g.layoutHint}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{g.imageIds.length} images</span>
                      {gIdx > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => mergeInto(g.id, groups[gIdx - 1]!.id)}
                          title="Merge into previous group"
                          className="h-6 px-2"
                        >
                          <GitMerge className="h-3 w-3" />
                        </Button>
                      )}
                      {g.imageIds.some((id) => selectedIds.has(id)) && g.imageIds.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => splitSelected(g.id)}
                          className="h-6 px-2 text-xs"
                        >
                          Split selected
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className={gridClassFor(g.layoutHint)}>
                    {g.imageIds.map((id) => {
                      const img = images[id];
                      if (!img) return null;
                      const isSelected = selectedIds.has(id);
                      return (
                        <div
                          key={id}
                          draggable
                          onDragStart={(e) => onDragStart(e, id)}
                          className={`relative group border rounded overflow-hidden bg-muted ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/50"}`}
                        >
                          {img.blob ? (
                            <img
                              src={URL.createObjectURL(img.blob)}
                              alt={img.alt}
                              className="w-full h-24 object-contain"
                              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                            />
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center text-xs text-destructive">
                              {img.fetchError ?? "Failed"}
                            </div>
                          )}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelected(id)}
                            className="absolute top-1 right-1 bg-background/80 backdrop-blur"
                            aria-label={`Select ${img.filename}`}
                          />
                          <button
                            onClick={() => handleDownload(img)}
                            className="absolute bottom-1 right-1 bg-background/80 backdrop-blur p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 backdrop-blur px-1 py-0.5 rounded truncate max-w-[80%]">
                            {img.filename}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function gridClassFor(hint: LayoutHint): string {
  if (hint === "horizontal") return "flex flex-wrap gap-2";
  if (hint === "vertical") return "flex flex-col gap-2";
  return "grid grid-cols-2 sm:grid-cols-3 gap-2";
}

interface TransformsPanelProps {
  transforms: TransformOptions;
  setTransforms: (t: TransformOptions) => void;
}

function TransformsPanel({ transforms, setTransforms }: TransformsPanelProps) {
  const update = (patch: Partial<TransformOptions>) => setTransforms({ ...transforms, ...patch });
  return (
    <div className="space-y-3 text-xs">
      <FieldRow label="Compress" enabled={transforms.compress?.enabled} onToggle={(v) => update({ compress: { quality: 80, ...transforms.compress, enabled: v } })}>
        <Input
          type="number"
          min={1}
          max={100}
          value={transforms.compress?.quality ?? 80}
          onChange={(e) => update({ compress: { ...transforms.compress!, quality: Number(e.target.value) } })}
          className="w-20 h-7"
          disabled={!transforms.compress?.enabled}
        />
      </FieldRow>
      <FieldRow label="Format" enabled={transforms.format?.enabled} onToggle={(v) => update({ format: { target: "png", ...transforms.format, enabled: v } })}>
        <select
          value={transforms.format?.target ?? "png"}
          onChange={(e) => update({ format: { ...transforms.format!, target: e.target.value as any } })}
          className="h-7 bg-background border border-border rounded px-2"
          disabled={!transforms.format?.enabled}
        >
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
      </FieldRow>
      <FieldRow label="Resize" enabled={transforms.resize?.enabled} onToggle={(v) => update({ resize: { mode: "exact", ...transforms.resize, enabled: v } })}>
        <div className="flex items-center gap-1">
          <Input type="number" placeholder="W" value={transforms.resize?.width ?? ""} onChange={(e) => update({ resize: { ...transforms.resize!, width: e.target.value ? Number(e.target.value) : undefined } })} className="w-16 h-7" disabled={!transforms.resize?.enabled} />
          <span>×</span>
          <Input type="number" placeholder="H" value={transforms.resize?.height ?? ""} onChange={(e) => update({ resize: { ...transforms.resize!, height: e.target.value ? Number(e.target.value) : undefined } })} className="w-16 h-7" disabled={!transforms.resize?.enabled} />
        </div>
      </FieldRow>
      <FieldRow label="Upscale" enabled={transforms.upscale?.enabled} onToggle={(v) => update({ upscale: { factor: 2, ...transforms.upscale, enabled: v } })}>
        <select
          value={transforms.upscale?.factor ?? 2}
          onChange={(e) => update({ upscale: { ...transforms.upscale!, factor: Number(e.target.value) as any } })}
          className="h-7 bg-background border border-border rounded px-2"
          disabled={!transforms.upscale?.enabled}
        >
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
          <option value={3}>3×</option>
          <option value={4}>4×</option>
        </select>
      </FieldRow>
      <div className="flex items-center gap-2">
        <Checkbox
          id="strip-exif"
          checked={transforms.stripExif}
          onCheckedChange={(v) => update({ stripExif: !!v })}
        />
        <Label htmlFor="strip-exif" className="text-xs">Strip EXIF / metadata</Label>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled?: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`field-${label}`}
        checked={!!enabled}
        onCheckedChange={(v) => onToggle(!!v)}
      />
      <Label htmlFor={`field-${label}`} className="text-xs w-20">{label}</Label>
      {children}
    </div>
  );
}
```

Note: imports were verified clean (removed unused `Trash2`/`ImageIcon`; replaced with `GitMerge` for the merge action). The `transforms.compress!` etc. non-null assertions are gated by the `enabled` checkbox so they are safe.

- [ ] **Step 2: Verify lint + build + tests**

Run:
```bash
npm test && npm run lint && npm run build
```
Expected: tests pass (existing), lint exits 0, build exits 0. Lint may flag unused imports — remove them.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`. Visit `http://localhost:8000/tools/image-extractor`. Paste sample HTML:
```html
<table>
  <tr>
    <td><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGUlEQVR4nGNkYGD4z8DAwMDw//9JD4MAAAAASUVORK5CYII=" alt="red"/></td>
    <td><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGUlEQVR4nGNkYGD4z8DAwMDw//9JD4MAAAAASUVORK5CYII=" alt="red"/></td>
  </tr>
</table>
```
Expected: extraction toast appears, group renders with layoutHint `grid`, hover-thumbnail shows download button, click downloads.

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/ImageExtractorTool.tsx src/pages/tools/ImageExtractor.tsx
git commit -m "feat(image-extractor): add main UI component with paste, extract, group, render, transforms, drag"
```

---

## Task 7: Wire into App.tsx (route + lazy import)

**Files:**
- Modify: `src/App.tsx` (2 lines: 1 lazy import + 1 route)

- [ ] **Step 1: Add lazy import in alphabetical position**

In `src/App.tsx`, find the lazy import section (around line 30-34). Add this line after the `ImageCombiner` import:
```ts
const ImageExtractor = lazy(() => import("./pages/tools/ImageExtractor"));
```

- [ ] **Step 2: Add route in alphabetical position**

In `src/App.tsx`, find the routes section (around line 130-134). Add this line after the `ImageCombiner` route:
```tsx
<Route path="/tools/image-extractor" element={<ImageExtractor />} />
```

- [ ] **Step 3: Verify lint + build**

Run:
```bash
npm run lint && npm run build
```
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): register /tools/image-extractor route"
```

---

## Task 8: Wire into Tools.tsx catalog + QuickSearch + generate-static-routes + enhance-html-for-bots

**Files:**
- Modify: `src/pages/Tools.tsx` (catalog entry + icon import)
- Modify: `src/components/QuickSearch.tsx` (search entry)
- Modify: `scripts/generate-static-routes.js` (route in array)
- Modify: `scripts/enhance-html-for-bots.js` (BOTH `toolFileMap` objects)

- [ ] **Step 1: Add to `src/pages/Tools.tsx`**

In `src/pages/Tools.tsx`:
1. Add `Images` to the lucide-react import on line 4:
```tsx
import { ..., Images } from "lucide-react";
```
2. Add catalog entry after `image-combiner` (after line 184):
```ts
  {
    id: "image-extractor",
    title: "Image Extractor",
    description: "Paste content from Google Docs or Word and extract all images grouped by their original layout. Apply compress, format, resize, or strip-EXIF transforms before downloading.",
    icon: Images,
    path: "/tools/image-extractor",
    color: "text-[hsl(var(--syntax-green))]",
  },
```

- [ ] **Step 2: Add to `src/components/QuickSearch.tsx`**

In `src/components/QuickSearch.tsx`:
1. Add `Images` to the lucide-react import on line 4:
```tsx
import { ..., Images } from "lucide-react";
```
2. Add entry to the `tools` array (after line 26):
```ts
  { name: "Image Extractor", description: "Extract images from Google Docs / Word", icon: Images, path: "/tools/image-extractor", keywords: ["image", "extract", "google docs", "docx", "scrape"] },
```

- [ ] **Step 3: Add to `scripts/generate-static-routes.js`**

In `scripts/generate-static-routes.js` line 88, after the `image-tool` route, add (note: this is for SEO generation — we DO want static HTML for the new tool):
```js
  '/tools/image-extractor',
```

Order in the `routes` array doesn't matter functionally; place it after the `image-combiner` area for readability.

- [ ] **Step 4: Add to BOTH `toolFileMap` objects in `scripts/enhance-html-for-bots.js`**

**First `toolFileMap`** (in `getToolsMetadata`, lines 154-175):
After the `listicle-template` entry (line 174), add:
```js
      'image-resizer': 'ImageResizer.tsx',
      'image-combiner': 'ImageCombiner.tsx',
      'image-extractor': 'ImageExtractor.tsx',
```

**Second `toolFileMap`** (in `extractToolIntroParagraphs`, lines 584-605):
After the `listicle-template` entry (line 604), add the same two:
```js
      'image-resizer': 'ImageResizer.tsx',
      'image-combiner': 'ImageCombiner.tsx',
      'image-extractor': 'ImageExtractor.tsx',
```

Note: the explore-agent report mentioned the existing toolFileMaps are MISSING image-resizer and image-combiner — adding all three at once fixes that pre-existing bug.

- [ ] **Step 5: Verify lint + build**

Run:
```bash
npm run lint && npm run build
```
Expected: both pass. Build also runs SEO generation — verify it logs `Created: /tools/image-extractor/index.html` and `✅ All checks passed!`.

- [ ] **Step 6: Verify the generated HTML**

Check `dist/tools/image-extractor/index.html` exists and has the SEO meta tags (title, description).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Tools.tsx src/components/QuickSearch.tsx scripts/generate-static-routes.js scripts/enhance-html-for-bots.js
git commit -m "feat(image-extractor): add to catalog, quick search, and SEO scripts"
```

---

## Task 9: Final verification

**Files:** None modified. Run verification commands.

- [ ] **Step 1: Run all tests**

Run:
```bash
npm test
```
Expected: all test files pass. Output: `Test Files N passed (N)`.

- [ ] **Step 2: Run lint**

Run:
```bash
npm run lint
```
Expected: exit code 0. May show 11 baseline warnings (shadcn UI stylistic) — same as before this feature.

- [ ] **Step 3: Run production build**

Run:
```bash
npm run build
```
Expected: build exits 0. Logs should show `Created: /tools/image-extractor/index.html` and `✅ All checks passed!`.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`. Open `http://localhost:8000/tools/image-extractor`.

Run through the spec's manual smoke tests:
1. Paste 4-image grid → 1 group with `grid` hint.
2. Paste 3-image vertical list → 1 group with `vertical` hint.
3. Paste mixed (grid + separate vertical) → 2 groups.
4. Drag image between groups → state updates.
5. Apply compress 80% + format WebP, click download → valid WebP file downloaded.
6. Paste HTML with expired URL → error card visible.
7. Visit `/tools` page → see "Image Extractor" card.
8. Press Cmd/Ctrl+K → search for "extract" → "Image Extractor" appears.

- [ ] **Step 5: Cleanup any leftover debug code**

Grep for `console.log`, `debugger`, or any TODO comments in the new files. Remove before final commit if any.

- [ ] **Step 6: Final commit (if any fixes)**

```bash
# Only if cleanup found issues
git add -A
git commit -m "chore(image-extractor): post-implementation cleanup"
```

---

## Self-Review Notes

Plan gaps vs. spec:
- ✅ All 5 spec sections covered (architecture, components, data flow, error handling, testing).
- ✅ Each spec user-facing requirement maps to a task:
  - Auto-group + manual override → Tasks 4, 6 (grouping logic + drag-drop UI)
  - All 3 image tool categories + new ones → Task 2 (`applyTransforms` composes compress + format + upscale + stripExif; reuses `resizeImage` via dynamic import)
  - Individual downloads only → Task 3 (`downloadImage`) + Task 6 (per-thumb download button)
- ✅ Implementation order in spec matches plan: libs → page wrapper → component → wire-in → verify.
- ✅ No ZIP, no refactor of existing tools (per scope-boundary).
- ✅ Type consistency: `ExtractedImage.id` used as React `key`; `ImageGroup.id` matches `g.imageIds[]` element; `TransformOptions` shape matches `applyTransforms` parameter.

Plan-level placeholders: none. All steps have either exact code, exact commands, or exact paths.

Risks:
1. `resizeImage()` signature mismatch — resolved at Task 2/6 by dynamic import; if signature diverges, swap for direct canvas resize.
2. jsdom + `createImageBitmap` — handled by test-setup polyfill from Task 2 if needed.
3. `tooltip`, `Input`, `Checkbox`, `Label`, `Collapsible` shadcn imports — assume they exist (verify with `grep "export.*Input\|export.*Checkbox" src/components/ui/`). If any missing, install via shadcn CLI (but that's out of scope for this plan — call out for user if hit).
