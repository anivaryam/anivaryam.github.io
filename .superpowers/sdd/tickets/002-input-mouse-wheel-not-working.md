# Ticket 002 — Input field mouse wheel doesn't scroll

**Status:** open
**Priority:** P1
**Component:** Image Extractor v2
**Affected files:**
- `src/components/tools/ImageExtractorTool.tsx` line 204 (contenteditable div)

## Description
The contenteditable input area on the left has `overflow-auto` (via Tailwind's `overflow-auto` class) which should enable vertical scrolling when content exceeds the container height. However, using the mouse wheel to scroll the pasted HTML content does not work — the wheel event appears to be intercepted or not reaching the element.

This is likely caused by the `LenisProvider` which handles smooth scrolling for the entire page. Lenis is known to intercept and hijack wheel events on nested elements, especially `contenteditable` regions, preventing native scroll behavior.

## Expected behavior
Users should be able to scroll the contenteditable input area with the mouse wheel when its content overflows the `max-h-[60vh]` boundary.

## Steps to reproduce
1. Navigate to the Image Extractor tool.
2. Paste a large amount of content (HTML with many images or long text) into the left input area.
3. Verify the content causes the container to scroll (visual scrollbar appears).
4. Attempt to scroll using the mouse wheel — the page scrolls instead of the input area.

## Suggested fix approach
The fix should intercept the wheel event on the contenteditable element and call `scrollTop` manually, bypassing Lenis for this nested scroll container:

```tsx
// On the contenteditable div (line ~200-206), add:
onWheel={(e) => {
  if (e.deltaY !== 0) {
    e.currentTarget.scrollTop += e.deltaY;
    e.stopPropagation();
    e.preventDefault();
  }
}}
```

Alternatively, check if Lenis has a `stopPropagation` option or if the contenteditable can be added to Lenis's ignore list via `data-lenis-stop` or a similar attribute.

## Notes
- The contenteditable already has `ref={inputAreaRef}` and `className="... overflow-auto"`, so the scroll infrastructure is in place — only the wheel event is being hijacked.
- Lenis is typically initialized at the app root; `ImageExtractorTool.tsx` likely does not directly import Lenis, so any Lenis-specific fixes may need to be applied at the LenisProvider level or via a CSS/HTML attribute that Lenis respects.
