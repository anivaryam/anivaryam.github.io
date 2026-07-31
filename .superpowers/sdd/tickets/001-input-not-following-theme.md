# Ticket 001 — Input text is fixed black, not following theme

**Status:** open
**Priority:** P1
**Component:** Image Extractor v2
**Affected files:**
- `src/components/tools/ImageExtractorTool.tsx` line 204 (contenteditable div, `.input-editable` class)
- `src/components/tools/ImageExtractorTool.tsx` lines 333-341 (inline `<style>` block)

## Description
The contenteditable input area on the left renders all text in fixed black color regardless of whether the app is in light or dark mode. In dark mode, the user types black text on a dark background, making the content unreadable.

The issue is likely caused by either:
1. The inline `<style>` block at the bottom of `ImageExtractorTool.tsx` (lines 333-341) setting a hardcoded `color` value on `.input-editable` or descendant selectors.
2. The contenteditable inheriting `color: black` from a global or component-level rule that overrides the theme CSS variable.

## Expected behavior
Text in the contenteditable input area should respect the `text-foreground` CSS variable (or `color: inherit`) so it adapts to the current theme — black text in light mode, light/white text in dark mode.

## Steps to reproduce
1. Set the app theme to dark mode.
2. Navigate to the Image Extractor tool.
3. Click on the left input area (contenteditable).
4. Type or paste some text.
5. Observe that text appears as black on dark background — unreadable.

## Suggested fix approach
1. Inspect the inline `<style>` block (lines 333-341) in `ImageExtractorTool.tsx`. If it contains `color: black` or any hardcoded foreground color on `.input-editable` or its descendants, remove or replace it with `color: inherit`.
2. If the issue persists, add an explicit `style={{ color: "inherit" }}` to the contenteditable div at line 200-206 to override any inherited black color.
3. Verify the fix by switching between light and dark themes and confirming text remains readable in both.

## Notes
- The inline `<style>` block is intended to force inline rendering of pasted images/tables (display: inline-block), not to set text color. Any color-related rules there should be audited.
- The contenteditable div already has `className="... input-editable"` and `style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}` — adding `color: inherit` to the existing style object would be the minimal fix.
