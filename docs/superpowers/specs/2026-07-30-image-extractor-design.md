# Image Extractor — Design

**Status:** Draft (awaiting user approval)
**Date:** 2026-07-30
**Author:** Sisyphus

## Purpose

A new tool in the Anivaryam suite that extracts all images from pasted HTML content (Google Docs, Word .docx, plain HTML), groups them by their source-document layout, and lets the user apply common image transforms (compress, format-convert, resize, upscale, strip-EXIF) before downloading each one individually.

Replaces the user's current multi-step workflow: paste → save images from preview → open ImageTool → process each → save again. This tool collapses that into a single pass.

## Non-Goals

- No ZIP / batch download (out of scope per user decision 2026-07-30).
- No file-upload `.docx` parsing (mammoth is unused in the codebase and out of scope).
- No refactor of existing `ImageTool`, `ImageResizer`, or `ImageCombiner`.
- No shared `<ImageTransformPanel>` component (deferred — not worth the cross-tool refactor cost yet).

## Decisions (locked via brainstorming)

1. **Grouping:** Auto-group by source HTML structure (DOM-based), with manual override (drag between groups, split, merge).
2. **Image tool integration:** All 3 existing image tool categories PLUS new helpers (strip EXIF, normalize) — exposed as a single inline settings panel before download.
3. **Download format:** Individual downloads only, no ZIP. No new dependencies.

## Architecture (Approach D)

**New files (5):**
- `src/pages/tools/ImageExtractor.tsx` — page wrapper. Modeled after `src/pages/tools/ImageResizer.tsx`. Includes `Layout`, `SEO`, breadcrumb.
- `src/components/tools/ImageExtractorTool.tsx` — main UI component. ~700 lines.
- `src/lib/image-extractor/extractor.ts` — pure functions: `extractImages(html)`, `srcToBlob(src)`, `downloadImage(blob, filename)`, `formatImageName(src, alt, index)`. No React.
- `src/lib/image-extractor/grouping.ts` — `groupImages(images, sourceDoc)` and helpers. Detects `table`/`p`/`div` ancestors and assigns `layoutHint`. No React.
- `src/lib/image-transforms/transforms.ts` — shared blob-in/blob-out helpers: `compressImage`, `convertImageFormat`, `upscaleImage`, `stripExif`, `applyTransforms(blob, options)`. Reuses `resizeImage` from `src/lib/image-resizer/resizer.ts`.

**Modified files (5):**
- `src/App.tsx` — add lazy import (model after line 11-44 pattern) + route at `/tools/image-extractor` (model after line 110-145 pattern).
- `src/pages/Tools.tsx` — add catalog entry to the `tools` array (lines 7-184). Shape: `{ id: "image-extractor", title: "Image Extractor", description: ..., icon: Images, path: "/tools/image-extractor", color: "text-purple-500" }`.
- `src/components/QuickSearch.tsx` — add search entry (lines 6-27). Shape: `{ name: "Image Extractor", description: ..., icon: Images, path: "/tools/image-extractor", keywords: ["image", "extract", "google docs", "docx", "scrape"] }`.
- `scripts/generate-static-routes.js` — add `'/tools/image-extractor'` to the routes array (lines 65-95).
- `scripts/enhance-html-for-bots.js` — add `image-extractor` → source file path to `toolFileMap` (around line 148-175).

**Reused from existing code (no modification):**
- Paste handler pattern from `src/components/tools/WordToHtmlConverter.tsx:653-682` (contenteditable + `paste` event listener + `innerHTML` read).
- `resizeImage()` from `src/lib/image-resizer/resizer.ts:13` (canvas-based resize with fill/fit/exact modes).
- `combineImages()` from `src/lib/image-combiner/combiner.ts:75` (only if needed for a "merge into one image" transform option; deferred unless surfaced).
- Page wrapper pattern from `src/pages/tools/ImageResizer.tsx` / `ImageCombiner.tsx`.

**No new dependencies.** All transforms use the canvas API (built-in). All downloads use `<a download>` + `URL.createObjectURL()`.

## Component structure

**`ImageExtractorTool` layout** — 2-column responsive:
```
┌─────────────────────────┬──────────────────────────┐
│  LEFT: Paste area       │  RIGHT: Extracted output │
│  (contenteditable div,  │  ┌─Settings panel (top)─┐│
│   same pattern as       │  │ Compress / Format /  ││
│   WordToHtmlConverter)  │  │ Resize / Upscale /   ││
│                         │  │ Strip EXIF toggles   ││
│                         │  └──────────────────────┘│
│                         │  ┌─Groups (list)────────┐│
│                         │  │ Group 1 (grid, 3 imgs)││
│                         │  │ ┌──┐ ┌──┐ ┌──┐       ││
│                         │  │ │  │ │  │ │  │       ││
│                         │  │ └──┘ └──┘ └──┘       ││
│                         │  │ Group 2 (vert, 2 imgs)││
│                         │  │ ┌──┐ ┌──┐           ││
│                         │  │ │  │ │  │           ││
│                         │  │ └──┘ └──┘           ││
│                         │  └──────────────────────┘│
└─────────────────────────┴──────────────────────────┘
```

**State shape:**
```ts
type ExtractedImage = {
  id: string;                          // crypto.randomUUID().slice(0, 8)
  src: string;                         // original (data: or http:)
  alt: string;                         // from img.alt or ""
  width?: number;                      // natural dims if known
  height?: number;
  blob: Blob | null;                   // fetched; null = fetch failed
  fetchError?: string;                 // populated on failure
  filename: string;                    // suggested download name
  groupId: string;                     // current group
};

type ImageGroup = {
  id: string;
  label: string;                       // "Group 1" / "Group 2" or user-renamed
  imageIds: string[];                  // ordered list of ExtractedImage ids
  layoutHint: 'grid' | 'vertical' | 'horizontal';  // derived from source DOM
};

type TransformOptions = {
  compress: { enabled: boolean; quality: number };        // quality: 0-100
  format: { enabled: boolean; target: 'png' | 'jpeg' | 'webp' };
  resize: { enabled: boolean; width?: number; height?: number; mode: 'exact' | 'fit' | 'fill' };
  upscale: { enabled: boolean; factor: 1.5 | 2 | 3 | 4 };
  stripExif: boolean;
};

type AppState = {
  inputHtml: string;
  extractedImages: Record<string, ExtractedImage>;  // by id
  groups: Record<string, ImageGroup>;                // by id
  transforms: TransformOptions;
  selectedGroupId: string | null;
  draggedImageId: string | null;
  dragOverGroupId: string | null;
  loading: boolean;
};
```

## Data flow

1. User pastes HTML into contenteditable input area.
2. Paste handler (modeled on `WordToHtmlConverter.tsx:657-682`) reads `inputArea.innerHTML` after a short tick → updates `inputHtml` state.
3. `useEffect` on `inputHtml` (debounced 250ms) triggers extraction.
4. `extractImages(html)`:
   - Parse with `DOMParser`
   - `querySelectorAll('img')` → for each:
     - `await srcToBlob(src)` — handles `data:` (base64 decode), `http(s):` (fetch with anonymous mode + CORS-error catch)
     - Load via `new Image()` + `onload` to get `naturalWidth` / `naturalHeight`
     - Generate `filename` from alt + index + url hash fallback
     - Return `ExtractedImage` (blob may be `null` if fetch fails)
5. `groupImages(images, sourceDoc)`:
   - Walk source DOM, for each `<img>` find nearest **layout-bearing ancestor** (`table`, `tbody`, `tr`, or a `p`/`div` if no table ancestor)
   - Group images sharing the same ancestor
   - Compute `layoutHint` per group: `table` → `'grid'`, single-line `<p>` chain → `'horizontal'`, separate `<p>` per image → `'vertical'`
6. UI renders groups + thumbnails in right column.
7. **Manual override actions:**
   - Drag thumb from group A → group B → updates `image.groupId` and both `groups[].imageIds` arrays
   - "Split group" button → multi-select images within a group, click Split → creates new group with selected images
   - "Merge groups" button → select 2 group headers, click Merge → combines into one
8. User adjusts `transforms` state in settings panel (collapsible card).
9. User clicks "Download" on a thumb:
   - `transformed = await applyTransforms(image.blob, transforms)`
   - `downloadImage(transformed, image.filename)`
10. Toasts on success/failure (use existing `useToast` hook).

## Error handling

| Failure | UX |
|---|---|
| Empty / non-HTML paste | "Paste content with images" placeholder visible; no group area. |
| Image fetch fails (CORS / 404 / expired URL) | Image card shows error icon + "Retry" button; `blob` stays `null`; download button disabled. |
| Blob transform fails (e.g., unsupported target format) | Toast: `"Transform failed — downloading original."`; original blob downloaded. |
| Drag image to invalid drop target | Image snaps back to origin group; no state change. |
| Group becomes empty after drag | Group auto-removes from rendered list; badge count updates. |
| Clipboard images (not HTML — e.g., screenshot paste) | Detected via `e.clipboardData.items` where `kind === 'file'` and `type.startsWith('image/')`; each becomes a single-image group with label "Pasted Image N". |
| Decoded data URI is malformed | Skip the image; toast aggregate `"Skipped N malformed images"` after extraction. |
| User pastes 100+ images | Extraction runs with progress indicator; groups render as user data resolves (no full blocking). |

## Testing

**Unit (added minimal Vitest setup if not present; reuse existing test config if found):**
- `src/lib/image-extractor/extractor.test.ts` — fixtures:
  - Google Docs HTML (4 images in one table)
  - Word .docx HTML (3 images in `<p>` chain)
  - Plain HTML with no images
  - HTML with mixed: data URI + http URL + malformed src
  - Asserts `length`, `blob != null` for valid sources, `fetchError` populated for invalid.
- `src/lib/image-extractor/grouping.test.ts` — asserts per committed rule in Data flow step 5:
  - Table-of-4 (4 `<img>` in `<table><tr><td>...`) → 1 group, `layoutHint: 'grid'`
  - 3 inline `<img>` siblings inside one `<p>` → 1 group, `layoutHint: 'horizontal'`
  - 3 `<p>` siblings each containing one `<img>` under one `<div>` → 1 group, `layoutHint: 'vertical'`
  - Mixed: 2 imgs in a `<table>` + 1 `<img>` in a separate `<p>` below → 2 groups (1 grid + 1 vertical)
- `src/lib/image-transforms/transforms.test.ts` — for each transform:
  - Compress a known PNG → output PNG has smaller file size
  - Convert PNG to JPEG → output is valid JPEG (`new Blob([..], {type:'image/jpeg'})` parses)
  - Resize 500x500 to 100x100 → dimensions correct
  - Strip EXIF from JPEG → EXIF bytes removed from header

**Manual smoke test (run by user):**
1. Paste Google Doc HTML with 4-image grid → expect 1 group of 4, `layoutHint: 'grid'`.
2. Paste Word .docx HTML with vertical 3-image list → expect 1 group of 3, `layoutHint: 'vertical'`.
3. Paste mixed (grid + caption + separate vertical) → expect 2 groups with correct hints.
4. Drag image between groups → state updates, re-render shows correct placement.
5. Apply compress 80% + format WebP, click download → file is valid WebP, smaller than original.
6. Paste HTML with one expired Google image URL → error card visible on that image, no crash.
7. Paste a screenshot (no HTML) → triggers image-paste branch, single-image group labeled "Pasted Image 1".

**Regression:** `npm run lint` exits 0, `npm run build` exits 0 (existing baseline).

## Implementation order (for writing-plans skill)

1. Create `src/lib/image-transforms/transforms.ts` + unit tests (no UI deps).
2. Create `src/lib/image-extractor/extractor.ts` + unit tests (no UI deps).
3. Create `src/lib/image-extractor/grouping.ts` + unit tests (no UI deps).
4. Create `src/components/tools/ImageExtractorTool.tsx` (UI shell, paste area, state wiring, progress indicator for batch image fetches).
5. Wire settings panel + transforms on download.
6. Wire drag/split/merge group actions.
7. Create `src/pages/tools/ImageExtractor.tsx` page wrapper.
8. Wire to `src/App.tsx`, `Tools.tsx`, `QuickSearch.tsx`, `generate-static-routes.js`, `enhance-html-for-bots.js`.
9. Manual smoke test. Verify lint + build green.

## Open questions

None at design time. All clarified during brainstorming session 2026-07-30.
