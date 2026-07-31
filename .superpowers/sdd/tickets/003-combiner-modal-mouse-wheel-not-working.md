# Ticket 003 — Combiner modal mouse wheel doesn't scroll

**Status:** open
**Priority:** P1
**Component:** Image Extractor v2
**Affected files:**
- `src/components/tools/ImageCombinerModal.tsx` line 58 (`DialogContent` with `overflow-y-auto`)
- `src/components/tools/ImageCombinerTool.tsx` (inner scroll containers inside the modal)

## Description
After clicking the "Image Combiner" button on a group and the modal opens, users cannot scroll the modal's contents using the mouse wheel. The `DialogContent` has `max-h-[90vh] overflow-y-auto` which should enable scrolling, but the same LenisProvider smooth-scroll hijacking issue from Ticket 002 likely applies here — Lenis intercepts wheel events on nested scrollable elements within the modal.

The issue may be compounded because the inner `ImageCombinerTool` (imported and rendered inside the modal) likely has its own scroll containers or interactive elements that also need wheel event passthrough.

## Expected behavior
Users should be able to scroll the modal's content with the mouse wheel when content exceeds the `max-h-[90vh]` boundary.

## Steps to reproduce
1. Paste content with multiple images into the Image Extractor.
2. Click "Image Combiner" on a group with 2+ images.
3. The modal opens.
4. Resize the window or add enough content to require scrolling.
5. Attempt to scroll with the mouse wheel — the page scrolls instead of the modal content.

## Suggested fix approach
Two-part fix likely required:

1. **Modal scroll container** — Add an `onWheel` handler to the `DialogContent` in `ImageCombinerModal.tsx` (line 58) to manually scroll when the mouse wheel is used:
```tsx
onWheel={(e) => {
  e.currentTarget.scrollTop += e.deltaY;
  e.stopPropagation();
  e.preventDefault();
}}
```

2. **Inner scroll containers** — If `ImageCombinerTool` (rendered inside `CombinerErrorBoundary` at line 66) has its own nested scroll areas, those may also need the same wheel passthrough treatment. Inspect `ImageCombinerTool.tsx` for any element with `overflow` classes and apply similar `onWheel` handlers.

## Notes
- This is the same root cause as Ticket 002 — LenisProvider intercepting wheel events.
- The `Dialog` component from shadcn/ui typically renders a portal overlay; wheel events on the portal container may need explicit handling.
- The fix should be coordinated with the Ticket 002 fix to ensure a consistent approach (possibly extracting a shared `useWheelPassthrough` hook).
