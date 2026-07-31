/**
 * Group extracted images by their source-DOM layout.
 *
 * Algorithm: post-order DOM walk. Separator elements
 * ({@link SEPARATOR_TAGS}) close the current group when walked past.
 * All other elements (div, span, table, br, section, etc.)
 * descend into children.
 *
 * Example: `<p>img1</p>img2<ul><li>img3</li></ul>img4`
 *   → [img1], [img2], [img3], [img4]
 */

import type { ExtractedImage } from "./extractor";

export type LayoutHint = "grid" | "horizontal" | "vertical";

export interface ImageGroup {
  id: string;
  label: string;
  imageIds: string[];
  layoutHint: LayoutHint;
}

const SEPARATOR_TAGS = new Set([
  "P", "STRONG", "UL", "OL", "LI",
  "H1", "H2", "H3", "H4", "H5",
]);

export function groupImages(
  images: ExtractedImage[],
  sourceDoc: Document,
): ImageGroup[] {
  if (images.length === 0) return [];

  const domImgs = Array.from(sourceDoc.querySelectorAll("img"));
  const bySrc = new Map<string, HTMLImageElement[]>();
  for (const dom of domImgs) {
    const s = dom.getAttribute("src") || "";
    if (!bySrc.has(s)) bySrc.set(s, []);
    bySrc.get(s)!.push(dom);
  }
  const usedDom = new WeakSet<HTMLImageElement>();
  let fallbackIdx = 0;
  const domToId = new Map<HTMLImageElement, string>();
  for (const img of images) {
    const candidates = bySrc.get(img.src) || [];
    let el = candidates.find((d) => !usedDom.has(d));
    if (!el) {
      while (fallbackIdx < domImgs.length && usedDom.has(domImgs[fallbackIdx]!)) {
        fallbackIdx++;
      }
      el = domImgs[fallbackIdx++];
    }
    if (el) {
      usedDom.add(el);
      domToId.set(el, img.id);
    }
  }

  const groups: string[][] = [];
  let current: string[] = [];

  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      if (child.tagName === "IMG") {
        const id = domToId.get(child as HTMLImageElement);
        if (id !== undefined) current.push(id);
        continue;
      }
      walk(child);
    }
    if (SEPARATOR_TAGS.has(node.tagName) && current.length > 0) {
      groups.push([...current]);
      current = [];
    }
  };

  walk(sourceDoc.body);
  if (current.length > 0) groups.push(current);

  return groups.map((imageIds, i) => ({
    id: `g${i + 1}`,
    label: `Group ${i + 1}`,
    imageIds,
    layoutHint: "horizontal" as LayoutHint,
  }));
}
