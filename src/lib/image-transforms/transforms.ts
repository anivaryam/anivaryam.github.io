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
    const file = new File([current], "image.png", { type: current.type });
    const out = await resizeImage(file, {
      width: pipeline.resize.width,
      height: pipeline.resize.height,
      mode: pipeline.resize.mode,
      format: "png",
      quality: 1,
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
