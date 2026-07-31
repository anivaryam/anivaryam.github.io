# Ticket 004 — Image Combiner button should hide for single-image groups

**Status:** open
**Priority:** P2
**Component:** Image Extractor v2
**Affected files:**
- `src/components/tools/ImageExtractorTool.tsx` lines 241-248 (Image Combiner button JSX inside `groups.map`)

## Description
The "Image Combiner" button currently renders unconditionally for every group, regardless of how many images the group contains. Since combining a single image produces no meaningful output (there is nothing to combine), the button should be hidden when a group has only one image. Currently it is clickable but functionally useless for single-image groups.

## Expected behavior
The "Image Combiner" button should only render when the group has 2 or more images (`g.imageIds.length > 1`). When a group has only 1 image, the button should not be visible.

## Steps to reproduce
1. Navigate to the Image Extractor tool.
2. Paste content that results in at least one group containing exactly 1 image.
3. Observe that the "Image Combiner" button is visible for that single-image group.
4. Click the button — a modal opens but combining 1 image is meaningless.

## Suggested fix approach
Wrap the Image Combiner button JSX (lines 241-248) with a conditional render:

```tsx
{g.imageIds.length > 1 && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setCombineOpenGroupId(g.id)}
    className="h-7 px-2 text-xs"
  >
    Image Combiner
  </Button>
)}
```

This is a one-line change — adding `{g.imageIds.length > 1 &&` before line 241 and closing the conditional after line 248.

## Notes
- The button currently sits inside a `<div className="flex items-center gap-2">` alongside the "Merge into previous group" button and the "Split selected" button. Both of those other buttons already have their own conditional visibility logic (`gIdx > 0` for merge, `g.imageIds.some(...) && g.imageIds.length > 1` for split), so following the same pattern for Image Combiner is consistent.
- The conditional should check `g.imageIds.length > 1` since combining 1 image is the degenerate case.
