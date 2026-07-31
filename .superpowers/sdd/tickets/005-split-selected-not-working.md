# Ticket 005 — Split Selected not working

**Status:** open
**Priority:** P0
**Component:** Image Extractor v2
**Affected files:**
- `src/components/tools/ImageExtractorTool.tsx` lines 141-162 (`splitSelected` function)
- `src/components/tools/ImageExtractorTool.tsx` lines 260-269 (Split selected button, gated by `g.imageIds.some((id) => selectedIds.has(id)) && g.imageIds.length > 1`)

## Description
The "Split selected" button is visible when images are selected in a group (line 260), but clicking it does not split the selected images into a new group. The state does not update, and the selected images remain in their original group. This is a core feature that is broken.

## Expected behavior
Clicking "Split selected" should:
1. Create a new `ImageGroup` containing only the selected image IDs.
2. Remove those selected image IDs from the source group.
3. Clear the `selectedIds` set.

## Steps to reproduce
1. Navigate to the Image Extractor tool.
2. Paste content with images that produce at least one group.
3. Select 1 or more images in a group using the checkboxes.
4. Click "Split selected".
5. Observe: the selected images remain in the original group; no new group is created; selectedIds is not cleared.

## Suggested fix approach
The `splitSelected` function (lines 141-162) should be audited for the following potential bugs:

**Bug A — `Math.max` with string IDs producing NaN:**
```tsx
// Line 147:
id: `g${Math.max(...groups.map((g) => Number(g.id.slice(1)) || 0), 0) + 1}`
```
If any group ID is not in the expected `g{N}` format, `Number(g.id.slice(1))` returns `NaN`, which causes `Math.max(...[NaN, ...], 0)` to return `NaN`, producing an ID like `gNaN`. Verify all group IDs match the `g{N}` pattern and consider using a safer ID generation approach (e.g., `Date.now()` or a UUID).

**Bug B — `source` reference from stale closure:**
```tsx
// Line 142:
const source = groups.find((g) => g.id === sourceGroupId);
```
If `groups` state has been updated but the callback captures a stale reference, `source` may be `undefined` and the early return at line 143 fires silently. Consider logging or asserting that `source` is found.

**Bug C — `flatMap` state setter returning undefined in edge cases:**
```tsx
// Lines 152-160:
setGroups((prev) => {
  const updated = prev.flatMap((g) => {
    if (g.id !== sourceGroupId) return [g];
    const remaining = g.imageIds.filter((id) => !toSplit.includes(id));
    if (remaining.length === 0) return [];  // removes group if empty after split
    return [{ ...g, imageIds: remaining }];
  });
  return [...updated, newGroup];
});
```
If `newGroup` is malformed (e.g., `imageIds` is empty due to `toSplit` being computed wrong), the flatMap may produce unexpected results.

**Bug D — `selectedIds` reset:**
```tsx
// Line 161:
setSelectedIds(new Set());
```
This looks correct, but if the state setter above does not trigger a re-render (e.g., due to referential equality of the returned array), the reset never takes effect. Verify the state update actually causes a re-render.

## Notes
- Marked P0 because this is a core user-facing feature (split functionality) that is entirely non-functional.
- The button visibility condition (line 260) already requires `g.imageIds.length > 1`, so splitting is only attempted when there are multiple images in the group.
- Consider adding a `console.log` or toast notification inside `splitSelected` to confirm the function is being called at all, as a first debugging step.
