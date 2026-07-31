// ─── Types ───────────────────────────────────────────────────────────────────

export type LayoutMode = "horizontal" | "vertical" | "grid-2" | "grid-3" | "grid-4";
export type SizingMode = "fit-to-row" | "keep-original" | "max-width";
export type OutputFormat = "png" | "jpeg" | "webp";

export interface CombinerOptions {
  layout: LayoutMode;
  sizing: SizingMode;
  gap: number;              // pixels between images
  outerPadding: number;     // pixels of padding around the whole result
  backgroundColor: string;    // CSS color string, e.g. "#ffffff" or "transparent"
  format: OutputFormat;
  quality: number;           // 0–1
  maxWidth: number;          // max total row width (used when sizing = "max-width")
}

export interface CombineResult {
  blob: Blob;
  width: number;
  height: number;
  size: number;
}

// ─── Image Loading ─────────────────────────────────────────────────────────────

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const fallback = () => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to read image dimensions"));
      };
      img.src = url;
    };
    if (typeof createImageBitmap !== "function") {
      fallback();
      return;
    }
    createImageBitmap(file)
      .then((bitmap) => {
        const { width, height } = bitmap;
        bitmap.close();
        resolve({ width, height });
      })
      .catch(fallback);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

// ─── Core Combination Algorithm ────────────────────────────────────────────────

/**
 * Combines multiple loaded images into a single canvas according to options.
 * Returns { blob, width, height, size }.
 */
export async function combineImages(
  images: HTMLImageElement[],
  options: CombinerOptions
): Promise<CombineResult> {
  if (images.length === 0) {
    throw new Error("No images to combine");
  }

  const { layout, sizing, gap, outerPadding, backgroundColor, format, quality, maxWidth } = options;

  // ── Step 1: Group images into rows ──────────────────────────────────────
  const rows: HTMLImageElement[][] = buildRows(images, layout);

  // ── Step 2: Calculate per-row dimensions based on sizing mode ─────────
  const layoutResult = computeRowLayout(rows, sizing, maxWidth, gap);

  // ── Step 3: Calculate total canvas dimensions ───────────────────────────
  const totalWidth = layoutResult.totalWidth + outerPadding * 2;
  const totalHeight = layoutResult.totalHeight + outerPadding * 2;

  // ── Step 4: Draw onto canvas ───────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Fill background
  if (backgroundColor === "transparent") {
    ctx.clearRect(0, 0, totalWidth, totalHeight);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalWidth, totalHeight);
  }

  // Set smoothing once (before all drawing)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw each row
  let y = outerPadding;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rowHeight = layoutResult.rowHeights[ri];

    let x = outerPadding;

    for (let ci = 0; ci < row.length; ci++) {
      const img = row[ci];
      const targetW = layoutResult.cellWidths[ri][ci];
      const targetH = rowHeight;

      ctx.drawImage(img, x, y, targetW, targetH);
      x += targetW + (ci < row.length - 1 ? gap : 0);
    }

    y += rowHeight + (ri < rows.length - 1 ? gap : 0);
  }

  // ── Step 5: Export to blob ───────────────────────────────────────────────
  const blob = await canvasToBlob(canvas, format, quality);
  return {
    blob,
    width: totalWidth,
    height: totalHeight,
    size: blob.size,
  };
}

// ─── Row Building ─────────────────────────────────────────────────────────────

function buildRows(
  images: HTMLImageElement[],
  layout: LayoutMode
): HTMLImageElement[][] {
  switch (layout) {
    case "horizontal":
      return [images];
    case "vertical":
      return images.map((img) => [img]);
    case "grid-2":
      return chunk(images, 2);
    case "grid-3":
      return chunk(images, 3);
    case "grid-4":
      return chunk(images, 4);
    default:
      return [images];
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── Layout Computation ─────────────────────────────────────────────────────

interface RowLayoutResult {
  rowHeights: number[];
  rowWidths: number[];
  cellWidths: number[][]; // [rowIdx][colIdx]
  totalWidth: number;
  totalHeight: number;
}

function computeRowLayout(
  rows: HTMLImageElement[][],
  sizing: SizingMode,
  maxWidth: number,
  gap: number
): RowLayoutResult {
  const rowHeights: number[] = [];
  const rowWidths: number[] = [];
  const cellWidths: number[][] = [];
  let totalWidth = 0;
  let totalHeight = 0;

  for (const row of rows) {
    const origHeights = row.map((img) => img.naturalHeight);
    const origWidths = row.map((img) => img.naturalWidth);
    const numCells = row.length;

    // Row height is determined by the tallest cell (after scaling)
    let rowH: number;
    if (sizing === "keep-original") {
      rowH = Math.max(...origHeights);
    } else if (sizing === "max-width") {
      // Scale images proportionally so the total row width fits within maxWidth
      const totalAspectRatio = origWidths.reduce((sum, w, i) => sum + w / origHeights[i], 0);
      rowH = Math.round(maxWidth / totalAspectRatio);
    } else {
      // fit-to-row: all cells in a row share the same height (the tallest original)
      rowH = Math.max(...origHeights);
    }

    rowHeights.push(rowH);

    // Compute per-cell widths
    const cw: number[] = [];
    for (let i = 0; i < numCells; i++) {
      if (sizing === "keep-original") {
        cw.push(origWidths[i]);
      } else if (sizing === "max-width") {
        // Width proportional to original aspect ratio, total capped at maxWidth
        cw.push(Math.round(origWidths[i] * (rowH / origHeights[i])));
      } else {
        // fit-to-row: scale width by same factor as height, maintaining aspect ratio
        cw.push(Math.round(origWidths[i] * (rowH / origHeights[i])));
      }
    }
    cellWidths.push(cw);

    const rowW = cw.reduce((a, b) => a + b, 0);
    rowWidths.push(rowW);
    totalWidth = Math.max(totalWidth, rowW);
    totalHeight += rowH + (rowWidths.length > 1 ? gap : 0);
  }

  // Subtract the last inter-row gap (no gap after the final row)
  if (rows.length > 1) totalHeight -= gap;

  return {
    rowHeights,
    rowWidths,
    cellWidths,
    totalWidth,
    totalHeight,
  };
}

// ─── Canvas Export ────────────────────────────────────────────────────────────

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to export canvas"));
      },
      `image/${format}`,
      format === "png" ? undefined : quality
    );
  });
}
