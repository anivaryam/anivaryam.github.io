/**
 * Mode Utility: List Label Spacing
 * 
 * Normalizes spacing after <strong> tags ending with colons in list items.
 * Assumes <strong> ending with ':' represents a label that should have a space
 * before the following content.
 * 
 * IMPORTANT: This function ONLY processes existing <strong> tags.
 * It does NOT create new <strong> tags for list items with colons.
 * List items with colons that are not originally bold will NOT be wrapped in <strong>.
 * 
 * If you see list items with colons being wrapped in <strong> tags when they weren't
 * originally bold, the wrapping is happening elsewhere in the pipeline (likely in
 * word-html-cleaner.ts normalizeFormattingTags or html-sanitizer.ts).
 * 
 * This is inline text normalization, not structural list normalization.
 */

import { findSourcesSections } from './mode-sources-section';

/**
 * Google Docs places a sub-list directly inside its parent list
 * (<ul><li>Parent</li><ul>…</ul></ul>). Move it into the preceding item, or
 * into a new item when none precedes it, so every list child is an <li>.
 */
function nestSubListsInItems(doc: Document): void {
  // Document order: an outer sub-list moves before the ones it contains.
  doc.querySelectorAll(':is(ul, ol) > :is(ul, ol)').forEach(list => {
    const previous = list.previousElementSibling;
    if (previous?.tagName.toLowerCase() === 'li') {
      previous.appendChild(list);
    } else {
      const item = doc.createElement('li');
      list.replaceWith(item);
      item.appendChild(list);
    }
  });
}

/** The next sibling of `node`, skipping whitespace-only text. */
function nextNonBlankSibling(node: Node): Node | null {
  let sibling = node.nextSibling;
  while (
    sibling &&
    sibling.nodeType === Node.TEXT_NODE &&
    !sibling.textContent?.trim()
  ) {
    sibling = sibling.nextSibling;
  }
  return sibling;
}

function mergeAdjacentUl(doc: Document): void {
  let hasChanges = true;
  
  while (hasChanges) {
    hasChanges = false;
    const uls = Array.from(doc.querySelectorAll('ul'));

    for (let i = 0; i < uls.length - 1; i++) {
      const currentUl = uls[i];
      const nextUl = uls[i + 1];

      if (nextNonBlankSibling(currentUl) === nextUl) {
        // Preserve every node, even if malformed input contains a wrapper.
        // Structural validation can flag it; merging must never delete content.
        while (nextUl.firstChild) currentUl.appendChild(nextUl.firstChild);
        nextUl.remove();
        hasChanges = true;
      }
    }
  }
}

/** The number an <ol> gives its first item; the sanitizer keeps `start` canonical. */
function listStart(list: Element): number {
  const start = parseInt(list.getAttribute('start') || '', 10);
  return Number.isNaN(start) ? 1 : start;
}

/**
 * Word Online pastes a numbered Sources list as one <ol start="N"> per item.
 * Merge each list that continues the count into the list after the label, so
 * the Sources steps and checks, which take that list, cover every item. A
 * list that restarts or skips the numbering, or uses another marker `type`,
 * is a separate list and stays. Other chains keep their own <ol start="N">
 * elements, which number correctly.
 */
function mergeSourcesListChains(doc: Document): void {
  findSourcesSections(doc).forEach(({ list }) => {
    if (!list?.matches('ol:not([reversed])')) return;
    let next = nextNonBlankSibling(list);
    while (
      next?.nodeType === Node.ELEMENT_NODE &&
      (next as Element).matches('ol:not([reversed])') &&
      (next as Element).getAttribute('type') === list.getAttribute('type') &&
      listStart(next as Element) === listStart(list) + list.querySelectorAll(':scope > li').length
    ) {
      while (next.firstChild) list.appendChild(next.firstChild);
      (next as Element).remove();
      next = nextNonBlankSibling(list);
    }
  });
}

/**
 * `mergeLists` is for the first pass only: lists that become adjacent later,
 * because a mode step removed what separated them (the article title), are
 * separate lists in the source and must stay apart.
 */
export function normalizeLists(html: string, mergeLists: boolean = true): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    nestSubListsInItems(doc);

    // Merge adjacent ul elements first
    if (mergeLists) {
      mergeAdjacentUl(doc);
      mergeSourcesListChains(doc);
    }
    
    // List item normalization: just clean up spacing, don't wrap with EM
    // (style attribute will be removed elsewhere in the pipeline)
    const normalizedListItems = doc.querySelectorAll('li');
    
    normalizedListItems.forEach(li => {
      // SAFEGUARD: Only query for existing <strong> tags - NEVER create new ones
      // This ensures list items with colons that weren't originally bold remain unbolded
      const strongTags = li.querySelectorAll('strong');
      
      strongTags.forEach(strong => {
        const strongText = strong.textContent || '';
        
        // Only process <strong> tags that end with ':' (assumes label format)
        // This ensures we only normalize spacing for originally-bold labels
        if (strongText.trim().endsWith(':')) {
          // Normalize colon spacing: remove trailing spaces before colon
          // Use node-level operations instead of innerHTML for consistency
          const lastChild = strong.lastChild;
          if (lastChild?.nodeType === Node.TEXT_NODE) {
            const text = lastChild.textContent || '';
            const normalized = text.replace(/:\s+$/, ':');
            if (normalized !== text) {
              lastChild.textContent = normalized;
            }
          }
          
          // Ensure space after strong tag (idempotent)
          const nextSibling = strong.nextSibling;
          if (nextSibling?.nodeType === Node.TEXT_NODE) {
            const text = (nextSibling as Text).textContent || '';
            const trimmed = text.trim();

            if (trimmed) {
              // Text node contains actual content
              // Check for leading whitespace (spaces or tabs)
              const leadingWhitespaceMatch = text.match(/^(\s+)/);
              const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';
              // Only the separator after the label changes; trailing
              // whitespace still separates this text from the next element.
              const separated = text.replace(/^\s*/, ' ');

              if (!leadingWhitespace) {
                // No leading space - add one
                (nextSibling as Text).textContent = separated;
              } else if (leadingWhitespace.length > 1 || leadingWhitespace !== ' ') {
                // Multiple leading spaces or non-space whitespace - normalize to single space
                (nextSibling as Text).textContent = separated;
              }
              // If exactly one leading space, content is already correct - no mutation needed
            } else {
              // Text node is empty/whitespace-only
              if (text !== ' ') {
                (nextSibling as Text).textContent = ' ';
              }
              // If text === ' ', it's already correct - no mutation needed
            }
          } else {
            // No text node after strong - insert space node
            strong.after(doc.createTextNode(' '));
          }
        }
      });
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('List label spacing normalization failed:', e);
    return html;
  }
}
