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
  base = base.replace(/[^a-zA-Z0-9_\-.\s]/g, "_").replace(/_+/g, "_");
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
  if (/^(https?:|blob:)/i.test(trimmed)) {
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

const ALT_TEXT_PATTERNS: RegExp[] = [
  /alt\s*text:\s*(.+?)(?=\s*(?:alt\s*text|alt\s*image\s*text|link):|$)/is,
  /alt\s*image\s*text:\s*(.+?)(?=\s*(?:alt\s*text|alt\s*image\s*text|link):|$)/is,
  /link:\s*(.+?)(?=\s*(?:alt\s*text|alt\s*image\s*text|link):|$)/is,
];

function detectAltTextFromContext(img: Element): string | null {
  const container = img.closest("p, div, li");
  if (!container) return null;
  const candidates: (Element | null)[] = [
    container,
    container.previousElementSibling,
    container.nextElementSibling,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = candidate.textContent;
    if (!text) continue;
    for (const pattern of ALT_TEXT_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const trimmed = match[1].trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return null;
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
    const contextAlt = detectAltTextFromContext(el);
    const alt = (el.getAttribute("alt") || "").trim() || contextAlt || "";
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
