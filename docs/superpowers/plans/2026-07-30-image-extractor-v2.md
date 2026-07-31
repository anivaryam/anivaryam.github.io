# Image Extractor v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Iterate the shipped Image Extractor to fix the image layout bug, replace DOM-layout grouping with separator-based grouping, remove the global transforms panel in favor of per-group tools, and surface Image Combiner as an optional per-group modal action.

**Architecture:** Two pure-lib changes + one optional prop extension to ImageCombinerTool + one rewritten top-level component + one new modal wrapper. Existing `extractor.ts`, `transforms.ts`, page wrapper, routes, and SEO wiring are untouched.

**Tech Stack:** Vite 7, React 18, TypeScript 5.9, shadcn/ui (existing `<Dialog>`, `<Button>`, `<Card>`, `<Checkbox>`, etc.), Vitest + jsdom (already configured).

**Spec:** `docs/superpowers/specs/2026-07-30-image-extractor-v2-design.md`

## Global Constraints

- **No new npm dependencies.**
- **TypeScript strict, no `as any` / `@ts-ignore`.** Pre-existing codebase casts at `ImageExtractorTool.tsx:540,560` (TransformsPanel select handlers, brief-mandated, controller-approved from v1) are acceptable.
- **Lint clean + build green** after each task (`npm run lint`, `npm run build` exit 0).
- **v1 tests still pass** (extractor 8, transforms 7) — no regressions.
- **v1 Important fix preserved**: `onDropGroup` empties groups on last-image-drag-out (commit `1739493`).
- **HTML Modal error boundary** wraps ImageCombinerTool so thrown errors don't break the page.
- **Manual smoke test deferred to user** (terminal controller cannot drive a browser).

---

## File Structure

| Path | Type | Lines | Responsibility |
|---|---|---|---|
| `src/lib/image-extractor/grouping.ts` | MODIFY | ~90 | Post-order separator algorithm |
| `src/lib/image-extractor/grouping.test.ts` | MODIFY | ~120 | New fixtures for separator algorithm |
| `src/components/tools/ImageCombinerTool.tsx` | MODIFY | +12 lines | Add optional `initialFiles?: File[]` prop |
| `src/components/tools/ImageCombinerModal.tsx` | NEW | ~50 | Dialog wrapping `<ImageCombinerTool>` with ErrorBoundary |
| `src/components/tools/ImageExtractorTool.tsx` | MODIFY | ~750 | Top-level component rewrite |
| `src/components/tools/ImageExtractorTool.tsx` (inline `<style>`) | MODIFY | +5 lines | `img { display: inline-block !important; ... }` |

**No new dependencies.**

---

## Task 1: Rewrite `grouping.ts` with separator algorithm + new tests

**Files:**
- Modify: `src/lib/image-extractor/grouping.ts`
- Modify: `src/lib/image-extractor/grouping.test.ts`

**Interfaces (consumed/produced):**
- Consumes: `ExtractedImage[]` from `./extractor`; `Document` source HTML
- Produces: `ImageGroup[]` (`{ id, label, imageIds, layoutHint }`) — same shape as v1

- [ ] **Step 1: Write the new test file (replacing v1 fixtures)**

Replace `src/lib/image-extractor/grouping.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { groupImages } from "./grouping";
import type { ExtractedImage } from "./extractor";

function makeImg(id: string, src = `data:image/png;base64,${id}`): ExtractedImage {
  return {
    id,
    src,
    alt: id,
    width: 10,
    height: 10,
    blob: null,
    filename: `${id}.png`,
  };
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("groupImages (separator algorithm)", () => {
  it("returns [] for empty images", () => {
    expect(groupImages([], parse("<p><img src='a'/></p>"))).toEqual([]);
  });

  it("returns [] when no <img> in source", () => {
    expect(groupImages([makeImg("a")], parse("<p>no images here</p>"))).toEqual([]);
  });

  it("1 image in <div> → 1 group", () => {
    const result = groupImages([makeImg("a")], parse("<div><img src='a'/></div>"));
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a"]);
  });

  it("2 images in same <p> → 1 group", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<p><img src='a'/><img src='b'/></p>"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });

  it("3 images each in own <p> → 3 groups", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b"), makeImg("c")],
      parse("<p><img src='a'/></p><p><img src='b'/></p><p><img src='c'/></p>"),
    );
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.imageIds)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("<p>img1</p><strong>img2</strong> → 2 groups", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<p><img src='a'/></p><strong><img src='b'/></strong>"),
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.imageIds).toEqual(["a"]);
    expect(result[1]!.imageIds).toEqual(["b"]);
  });

  it("2 images separated by <br> → 1 group (BR is not a separator)", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<br><img src='a'/><br><img src='b'/><br>"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });

  it("2 images inside <table> → 1 group (TABLE descends)", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b")],
      parse("<table><tr><td><img src='a'/></td><td><img src='b'/></td></tr></table>"),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });

  it("<p>img1</p><p>img2</p><p>img3</p><ul><li>img4</li></ul> → 4 groups", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b"), makeImg("c"), makeImg("d")],
      parse(
        "<p><img src='a'/></p><p><img src='b'/></p><p><img src='c'/></p><ul><li><img src='d'/></li></ul>",
      ),
    );
    expect(result).toHaveLength(4);
  });

  it("preserves image order within a group", () => {
    const result = groupImages(
      [makeImg("a"), makeImg("b"), makeImg("c")],
      parse("<p><img src='a'/><img src='b'/></p><p><img src='c'/></p>"),
    );
    expect(result[0]!.imageIds).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (the new fixtures exercise behaviors the old impl doesn't have)**

Run:
```bash
npm test -- src/lib/image-extractor/grouping
```
Expected: tests FAIL — the v1 implementation produces the wrong group counts (e.g., it groups 3 separate `<p>` siblings into 1 group, but the new test expects 3).

- [ ] **Step 3: Replace `src/lib/image-extractor/grouping.ts` with the post-order algorithm**

Replace the file with:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- src/lib/image-extractor/grouping
```
Expected: all 10 fixtures pass.

- [ ] **Step 5: Verify lint + build + v1 regression**

Run:
```bash
npm test && npm run lint && npm run build
```
Expected: `npm test`: 27 tests pass total (10 grouping + 8 extractor + 7 transforms + 1 WebP skip + 1 smoke). `npm run lint` exits 0. `npm run build` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image-extractor/grouping.ts src/lib/image-extractor/grouping.test.ts
git commit -m "feat(image-extractor): replace DOM-layout grouping with separator-based algorithm (P/STRONG/UL/OL/LI/H1-5 close current group post-order)"
```

---

## Task 2: Extend `ImageCombinerTool` + create `ImageCombinerModal`

**Files:**
- Modify: `src/components/tools/ImageCombinerTool.tsx` — add optional `initialFiles?: File[]` prop
- Create: `src/components/tools/ImageCombinerModal.tsx`

**Interfaces (consumed/produced):**
- Consumes (for `ImageCombinerModal`): `ExtractedImage[]` (group's images with blobs), `groupId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`
- Produces: a Dialog containing `<ImageCombinerTool>` pre-populated with the group's blobs as File objects

- [ ] **Step 1: Write the ImageCombinerModal test file**

Create `src/components/tools/ImageCombinerModal.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImageCombinerModal } from "./ImageCombinerModal";
import type { ExtractedImage } from "@/lib/image-extractor/extractor";

const makeImage = (id: string): ExtractedImage => ({
  id,
  src: `data:image/png;base64,${id}`,
  alt: id,
  width: 10,
  height: 10,
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  filename: `${id}.png`,
});

describe("ImageCombinerModal", () => {
  it("renders nothing when closed", () => {
    render(
      <ImageCombinerModal
        groupId="g1"
        images={[makeImage("a")]}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders Dialog when open", () => {
    render(
      <ImageCombinerModal
        groupId="g1"
        images={[makeImage("a"), makeImage("b")]}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

> Note: this requires `@testing-library/react` to be added as a devDependency if not present. If it isn't already installed, run `npm install -D @testing-library/react`. **Check `package.json` first**; if not there, install via `npm install -D @testing-library/react @testing-library/dom`. If installed, skip this install step.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/components/tools/ImageCombinerModal
```
Expected: FAIL — `./ImageCombinerModal` does not exist yet.

- [ ] **Step 3: Extend `ImageCombinerTool` to accept `initialFiles?: File[]`**

Open `src/components/tools/ImageCombinerTool.tsx`. Apply these three edits:

**Edit 3a — Add prop interface:**

Find the component declaration on line 163:
```tsx
export function ImageCombinerTool() {
```
Replace with:
```tsx
interface ImageCombinerToolProps {
  /** Optional pre-population: File objects loaded into the combiner's images list on mount. */
  initialFiles?: File[];
}

export function ImageCombinerTool({ initialFiles }: ImageCombinerToolProps = {}) {
```

**Edit 3b — Add `useEffect` to populate from `initialFiles`:**

Add to the React import (line 1):
```ts
import { useState, useEffect, useRef, useCallback } from "react";
```
(The other imports already exist.)

Find the `loadFiles` useCallback definition (around line 319). Immediately after it (still inside the component body), add:
```tsx
useEffect(() => {
  if (initialFiles && initialFiles.length > 0) {
    loadFiles(initialFiles);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Initial population only — run once on mount.
```

**Edit 3c — Verify typecheck**

Confirm `useEffect` is now imported at the top of the file (already imported via the edit in 3b).

- [ ] **Step 4: Create `src/components/tools/ImageCombinerModal.tsx`**

Create file `src/components/tools/ImageCombinerModal.tsx`:

```tsx
import { Component, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImageCombinerTool } from "@/components/tools/ImageCombinerTool";
import type { ExtractedImage } from "@/lib/image-extractor/extractor";

interface ImageCombinerModalProps {
  groupId: string;
  images: ExtractedImage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

class CombinerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Image Combiner encountered an error. Close this dialog and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

function extImageToFile(img: ExtractedImage): File | null {
  if (!img.blob) return null;
  return new File([img.blob], img.filename, { type: img.blob.type || "image/png" });
}

export function ImageCombinerModal({
  groupId,
  images,
  open,
  onOpenChange,
}: ImageCombinerModalProps) {
  const initialFiles = images
    .map(extImageToFile)
    .filter((f): f is File => f !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Combine Images</DialogTitle>
          <DialogDescription>
            {initialFiles.length} image{initialFiles.length === 1 ? "" : "s"} from group {groupId} — arrange and combine.
          </DialogDescription>
        </DialogHeader>
        <CombinerErrorBoundary>
          <ImageCombinerTool initialFiles={initialFiles} />
        </CombinerErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run tests**

Run:
```bash
npm test
```
Expected: all suites pass — 27 + 2 (the 2 new ImageCombinerModal tests if you installed `@testing-library/react`; otherwise the spec note applies and the modal test is skipped via `@testing-library/react not installed`).

- [ ] **Step 6: Verify lint + build**

Run:
```bash
npm run lint && npm run build
```
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/tools/ImageCombinerTool.tsx src/components/tools/ImageCombinerModal.tsx src/components/tools/ImageCombinerModal.test.ts package.json package-lock.json 2>/dev/null
git add src/components/tools/ImageCombinerTool.tsx src/components/tools/ImageCombinerModal.tsx src/components/tools/ImageCombinerModal.test.ts
git commit -m "feat(image-extractor): add ImageCombinerModal (Dialog + ErrorBoundary) and ImageCombinerTool initialFiles prop for pre-population"
```

---

## Task 3: Rewrite `ImageExtractorTool.tsx` with CSS layout fix, per-group transforms, per-image Download, Combine Images button + Modal

**Files:**
- Modify: `src/components/tools/ImageExtractorTool.tsx` (top-level component rewrite — see code below)

**Interfaces (consumed from earlier tasks):**
- `extractImages`, `downloadImage`, `ExtractedImage` from `@/lib/image-extractor/extractor`
- `groupImages`, `ImageGroup`, `LayoutHint` from `@/lib/image-extractor/grouping` (now post-order algorithm)
- `applyTransforms`, `TransformPipeline`, `TargetFormat`, `CompressOptions`, `FormatOptions`, `UpscaleOptions`, `ResizeOptions` from `@/lib/image-transforms/transforms`
- `ImageCombinerModal` from `@/components/tools/ImageCombinerModal` (Task 2)

- [ ] **Step 1: Replace `src/components/tools/ImageExtractorTool.tsx`**

Replace the entire file with:

```tsx
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Download, GitMerge, X } from "lucide-react";
import { extractImages, downloadImage, type ExtractedImage } from "@/lib/image-extractor/extractor";
import { groupImages, type ImageGroup, type LayoutHint } from "@/lib/image-extractor/grouping";
import {
  applyTransforms,
  type TargetFormat,
  type TransformPipeline,
} from "@/lib/image-transforms/transforms";
import { ImageCombinerModal } from "./ImageCombinerModal";

interface GroupTransformOptions {
  compress: { enabled: boolean; quality: number };
  format: { enabled: boolean; target: TargetFormat };
  resize: { enabled: boolean; mode: "exact" | "fit" | "fill"; width?: number; height?: number };
  upscale: { enabled: boolean; factor: 1.5 | 2 | 3 | 4 };
  stripExif: boolean;
}

const DEFAULT_GROUP_TRANSFORMS: GroupTransformOptions = {
  compress: { enabled: false, quality: 80 },
  format: { enabled: false, target: "png" },
  resize: { enabled: false, mode: "exact" },
  upscale: { enabled: false, factor: 2 },
  stripExif: false,
};

function rebuildPipeline(t: GroupTransformOptions): TransformPipeline {
  const p: TransformPipeline = {};
  if (t.upscale.enabled) p.upscale = { factor: t.upscale.factor };
  if (t.resize.enabled && t.resize.width && t.resize.height) {
    p.resize = {
      mode: t.resize.mode,
      width: t.resize.width,
      height: t.resize.height,
    };
  }
  if (t.format.enabled) p.format = { target: t.format.target };
  if (t.stripExif) p.stripExif = true;
  if (t.compress.enabled) p.compress = { quality: t.compress.quality };
  return p;
}

export function ImageExtractorTool() {
  const { toast } = useToast();
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const [inputHtml, setInputHtml] = useState("");
  const [images, setImages] = useState<Record<string, ExtractedImage>>({});
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupTransforms, setGroupTransforms] = useState<Record<string, GroupTransformOptions>>({});
  const [toolsOpen, setToolsOpen] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [combineOpenGroupId, setCombineOpenGroupId] = useState<string | null>(null);
  const draggedImageId = useRef<string | null>(null);

  // Paste handler: passthrough, then read innerHTML (preserved from v1).
  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const onPaste = () => {
      setTimeout(() => {
        const content = el.innerHTML;
        if (content.trim()) setInputHtml(content);
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

  // Extract + group on inputHtml change (debounced) — using v2 separator algorithm.
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
    setSelectedIds(new Set());
    setGroupTransforms({});
    setToolsOpen({});
  }, []);

  const getGroupTransforms = (gid: string): GroupTransformOptions =>
    groupTransforms[gid] ?? DEFAULT_GROUP_TRANSFORMS;
  const setGroupTransformsFor = (gid: string, t: GroupTransformOptions) =>
    setGroupTransforms((prev) => ({ ...prev, [gid]: t }));

  // Per-image original download (no transforms).
  const downloadOriginal = useCallback(
    (img: ExtractedImage) => {
      if (!img.blob) {
        toast({ title: "Cannot download", description: img.fetchError ?? "No image data", variant: "destructive" });
        return;
      }
      downloadImage(img.blob, img.filename);
    },
    [toast],
  );

  // Group Download all: apply group's transforms to each image, loop downloads.
  const downloadGroupAll = useCallback(
    async (gid: string) => {
      const group = groups.find((g) => g.id === gid);
      if (!group) return;
      const t = getGroupTransforms(gid);
      const pipeline = rebuildPipeline(t);
      const hasTransform = Object.keys(pipeline).length > 0;
      let skipped = 0;
      let downloaded = 0;
      for (const imgId of group.imageIds) {
        const img = images[imgId];
        if (!img || !img.blob) {
          skipped++;
          continue;
        }
        try {
          const out = hasTransform ? await applyTransforms(img.blob, pipeline) : img.blob;
          downloadImage(out, img.filename);
          downloaded++;
        } catch (e) {
          skipped++;
          console.error("transform failed for", img.filename, e);
        }
      }
      if (skipped > 0) {
        toast({
          title: `${downloaded} downloaded, ${skipped} skipped (fetch/transform failed)`,
          variant: skipped > downloaded ? "destructive" : "default",
        });
      } else if (downloaded > 0) {
        toast({ title: `${downloaded} downloaded` });
      }
    },
    [groups, images, getGroupTransforms, toast],
  );

  // Drag-drop between groups (preserved from v1, with v1 fix for empty groups).
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
    let sourceGroupId: string | null = null;
    for (const g of groups) {
      if (g.imageIds.includes(imgId)) {
        sourceGroupId = g.id;
        break;
      }
    }
    if (!sourceGroupId || sourceGroupId === targetGroupId) return;
    setGroups((prev) =>
      prev.flatMap((g) => {
        if (g.id === sourceGroupId) {
          const next = { ...g, imageIds: g.imageIds.filter((id) => id !== imgId) };
          return next.imageIds.length === 0 ? [] : [next];
        }
        if (g.id === targetGroupId) {
          return [{ ...g, imageIds: [...g.imageIds, imgId] }];
        }
        return [g];
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
      layoutHint: "horizontal",
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
    setGroups((prev) =>
      prev.flatMap((g) => {
        if (g.id === targetGroupId) {
          return [{ ...g, imageIds: [...g.imageIds, ...source.imageIds] }];
        }
        if (g.id === sourceGroupId) return [];
        return [g];
      }),
    );
  };

  // Compute the images for the open Combine modal (lazily).
  const combineGroup = combineOpenGroupId
    ? groups.find((g) => g.id === combineOpenGroupId) ?? null
    : null;
  const combineImages = combineGroup
    ? combineGroup.imageIds.map((id) => images[id]).filter((i): i is ExtractedImage => !!i)
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT: paste area */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Input</CardTitle>
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
            className="flex-1 min-h-[300px] max-h-[60vh] p-4 text-sm bg-background border border-border rounded-lg overflow-auto focus:outline-none focus:ring-2 focus:ring-primary/20 input-editable"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          />
          {loading && (
            <p className="mt-2 text-xs text-muted-foreground">Extracting images…</p>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: extracted groups */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Extracted</CardTitle>
          <span className="text-xs text-muted-foreground">
            {Object.keys(images).length} image{Object.keys(images).length === 1 ? "" : "s"} ·{" "}
            {groups.length} group{groups.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCombineOpenGroupId(g.id)}
                        className="h-7 px-2 text-xs"
                      >
                        Combine Images
                      </Button>
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                            onClick={() => downloadOriginal(img)}
                            className="absolute bottom-1 right-1 bg-background/80 backdrop-blur p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download original"
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

                  {/* Per-group Tools sub-panel (collapsible, optional). */}
                  <Collapsible
                    open={!!toolsOpen[g.id]}
                    onOpenChange={(o) =>
                      setToolsOpen((prev) => ({ ...prev, [g.id]: o }))
                    }
                    className="mt-3 border-t border-border/50 pt-2"
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        Tools (optional — applied to Download all)
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${toolsOpen[g.id] ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <GroupTransformsPanel
                        gid={g.id}
                        transforms={getGroupTransforms(g.id)}
                        setTransforms={(t) => setGroupTransformsFor(g.id, t)}
                      />
                      <Button
                        onClick={() => downloadGroupAll(g.id)}
                        className="w-full mt-3"
                      >
                        Download all
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Combiner modal — mounts when a group's "Combine Images" is clicked. */}
      <ImageCombinerModal
        groupId={combineGroup?.id ?? ""}
        images={combineImages}
        open={!!combineOpenGroupId}
        onOpenChange={(o) => { if (!o) setCombineOpenGroupId(null); }}
      />

      {/* Layout fix: pasted images must render inline-by-default. */}
      <style>{`
        .input-editable img,
        .input-editable table,
        .input-editable p {
          display: inline-block !important;
          vertical-align: middle;
          max-width: 100%;
        }
      `}</style>
    </div>
  );
}

interface GroupTransformsPanelProps {
  gid: string;
  transforms: GroupTransformOptions;
  setTransforms: (t: GroupTransformOptions) => void;
}

function GroupTransformsPanel({ transforms, setTransforms }: GroupTransformsPanelProps) {
  const update = (patch: Partial<GroupTransformOptions>) =>
    setTransforms({ ...transforms, ...patch });
  return (
    <div className="space-y-2 text-xs">
      <FieldRow
        label="Compress"
        enabled={transforms.compress.enabled}
        onToggle={(v) =>
          update({ compress: { quality: 80, ...transforms.compress, enabled: v } })
        }
      >
        <Input
          type="number"
          min={1}
          max={100}
          value={transforms.compress.quality}
          onChange={(e) =>
            update({ compress: { ...transforms.compress!, quality: Number(e.target.value) } })
          }
          className="w-20 h-7"
          disabled={!transforms.compress.enabled}
        />
      </FieldRow>
      <FieldRow
        label="Format"
        enabled={transforms.format.enabled}
        onToggle={(v) =>
          update({ format: { target: "png", ...transforms.format, enabled: v } })
        }
      >
        <select
          value={transforms.format.target}
          onChange={(e) =>
            update({ format: { ...transforms.format!, target: e.target.value as TargetFormat } })
          }
          className="h-7 bg-background border border-border rounded px-2"
          disabled={!transforms.format.enabled}
        >
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
      </FieldRow>
      <FieldRow
        label="Resize"
        enabled={transforms.resize.enabled}
        onToggle={(v) =>
          update({ resize: { mode: "exact", ...transforms.resize, enabled: v } })
        }
      >
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="W"
            value={transforms.resize.width ?? ""}
            onChange={(e) =>
              update({
                resize: {
                  ...transforms.resize!,
                  width: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            className="w-16 h-7"
            disabled={!transforms.resize.enabled}
          />
          <span>×</span>
          <Input
            type="number"
            placeholder="H"
            value={transforms.resize.height ?? ""}
            onChange={(e) =>
              update({
                resize: {
                  ...transforms.resize!,
                  height: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            className="w-16 h-7"
            disabled={!transforms.resize.enabled}
          />
        </div>
      </FieldRow>
      <FieldRow
        label="Upscale"
        enabled={transforms.upscale.enabled}
        onToggle={(v) =>
          update({ upscale: { factor: 2, ...transforms.upscale, enabled: v } })
        }
      >
        <select
          value={transforms.upscale.factor}
          onChange={(e) =>
            update({ upscale: { ...transforms.upscale!, factor: Number(e.target.value) as 1.5 | 2 | 3 | 4 } })
          }
          className="h-7 bg-background border border-border rounded px-2"
          disabled={!transforms.upscale.enabled}
        >
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
          <option value={3}>3×</option>
          <option value={4}>4×</option>
        </select>
      </FieldRow>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`strip-exif-${transforms ? "x" : "y"}`}
          checked={transforms.stripExif}
          onCheckedChange={(v) => update({ stripExif: !!v })}
        />
        <Label className="text-xs">Strip EXIF / metadata</Label>
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
  children: ReactNode;
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

- [ ] **Step 2: Run lint + build + tests**

Run:
```bash
npm test && npm run lint && npm run build
```
Expected: `npm test`: 27 + 2 = 29 passing (1 WebP skip). `npm run lint` exits 0 with no new warnings (the existing 11 baseline warnings are unchanged). `npm run build` exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/ImageExtractorTool.tsx
git commit -m "feat(image-extractor): rewrite component for v2 — CSS image layout fix, per-group transforms, per-image original download, Image Combiner modal trigger"
```

---

## Task 4: Final verification

**Files:** None modified.

- [ ] **Step 1: Run all tests**

Run:
```bash
npm test
```
Expected: ~29 tests pass (10 grouping + 8 extractor + 7 transforms + 2 ImageCombinerModal + 2 v1 smoke). 1 WebP conditional skip.

- [ ] **Step 2: Run lint**

Run:
```bash
npm run lint
```
Expected: exit 0, 11 baseline warnings (pre-existing shadcn UI stylistic warnings), 0 new warnings from the v2 work.

- [ ] **Step 3: Run production build**

Run:
```bash
npm run build
```
Expected: build exits 0; logs should show `Created: /tools/image-extractor/index.html` and `✅ All checks passed!`.

- [ ] **Step 4: Verify generated SEO HTML**

Run:
```bash
ls -la dist/tools/image-extractor/index.html
```
Expected: file exists. (Visual verification of meta tags is the user's manual smoke step.)

- [ ] **Step 5: Commit (if any fixes were needed)**

Skip — no commits expected for a verification-only task. If `npm test`, `npm run lint`, or `npm run build` failed, fix and commit per the failure, then re-run the verification loop.

---

## Self-Review Notes

Plan gaps vs. spec:

- ✅ Section 1 (architecture + data flow) covered by Tasks 2, 3 with explicit file mentions and component responsibilities.
- ✅ Section 2 (components & state) — `ImageExtractorTool.tsx` rewrite in Task 3 includes all state vars (`groupTransforms`, `toolsOpen`, `combineOpenGroupId`, etc.) + `GroupTransformOptions` type + handler functions (`rebuildPipeline`, `getGroupTransforms`, `setGroupTransformsFor`, `downloadOriginal`, `downloadGroupAll`).
- ✅ Section 3 (error handling) — `CombinerErrorBoundary` in Task 2; `downloadGroupAll` skips failed blobs with toast count in Task 3; per-image error cards preserved.
- ✅ Section 4 (testing) — Task 1 has 10 grouping fixtures; Task 2 has 2 ImageCombinerModal render fixtures; v1's 20 tests still pass.

Real changes from spec:
- **ImageCombinerTool extension (3 lines added):** The spec assumed `<ImageCombinerTool images={images} />` was its API. It's not — ImageCombinerTool takes no props and ingests files internally. Adding an optional `initialFiles?: File[]` prop + a mount-time `useEffect` to populate via its existing `loadFiles` internal is the minimal 5-line integration extension. This is explicitly called out in Task 2's edit 3b. **Do not skip this** — without it, the modal will open empty.

- **Implementation order:** Task 1 → 2 → 3 → 4. Task 1 is standalone. Task 2 depends on nothing in this plan but uses Task 2's own extension. Task 3 depends on Tasks 1 (new `groupImages`) and 2 (new `ImageCombinerModal`).

Risks called out:
- ImageCombinerTool extension (above).
- `npm test` may require `@testing-library/react` for Task 2's render tests (Step 1 install).
- Cleanup: no `console.log` / `debugger` / `TODO` should remain in the new files.
