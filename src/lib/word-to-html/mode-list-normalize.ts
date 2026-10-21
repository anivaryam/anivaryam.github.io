/**
 * Mode Utility: List Label Spacing
 * 
 * Normalizes spacing after <strong> tags ending with colons in list items.
 * Assumes <strong> ending with ':' represents a label that should have a space
 * before the following content.
 * 
 * IMPORTANT: Regular mode ONLY processes existing <strong> tags; list items
 * with colons that are not originally bold are NOT wrapped in <strong>.
 * Blogs and Shoppables bold an unbolded label (`boldLabels`, see
 * findListLabel for what counts as one) outside Sources lists.
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

/** A list item's label colon ("Tip: …"), as found by findListLabel. */
export interface ListLabel {
  /** The text run holding the colon. */
  text: Text;
  /** Offset of the colon in `text`. */
  colon: number;
  /** The item's text before `text`; blank when the colon is in its first text run. */
  before: string;
  /** True when a <strong> or <b> holds the colon. */
  bold: boolean;
}

/**
 * The label colon of a list item: its first colon followed by whitespace or
 * the end of its text run, with label text before it and no sentence end
 * (`.`, `!`, `?`) in that text, so "9:30 am", "1:2 ratio" and URLs never
 * match. Nested lists hold their own items' text. Shared by the converter,
 * which bolds such labels, and the ol-bold-labels check.
 */
export function findListLabel(li: Element): ListLabel | null {
  const walker = li.ownerDocument.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  let before = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('li') !== li) continue;
    const text = node as Text;
    const match = /:(?=\s|$)/.exec(text.data);
    if (!match) {
      before += text.data;
      continue;
    }
    const label = before + text.data.slice(0, match.index);
    if (!label.trim() || /[.!?]/.test(label)) return null;
    const bold = text.parentElement?.closest('strong, b');
    return { text, colon: match.index, before, bold: !!bold && li.contains(bold) };
  }
  return null;
}

/** True when only emphasis or underline lies between `node` and its item. */
function isInItemText(node: Node, li: Element): boolean {
  for (let parent = node.parentElement; parent !== li; parent = parent?.parentElement ?? null) {
    if (!parent?.matches('em, u')) return false;
  }
  return true;
}

/**
 * Bold each unbolded list label outside Sources, with the colon inside the
 * bold: "Tip: Try" and "<strong>Tip</strong>: Try" both become
 * "<strong>Tip:</strong> Try". Only a label in the item's first text run (or
 * in a leading bold) inside the item itself or its emphasis/underline is
 * changed; a label split across other elements stays as it is (never break
 * markup) and the ol-bold-labels check reports it.
 */
function boldListLabels(doc: Document): void {
  const sourcesLists = findSourcesSections(doc).flatMap(({ list }) => list ? [list] : []);
  doc.querySelectorAll('li').forEach(li => {
    if (sourcesLists.some(list => list.contains(li))) return;
    const label = findListLabel(li);
    if (!label || label.bold || !isInItemText(label.text, li)) return;
    const { text, colon } = label;

    if (!label.before.trim()) {
      // Leading whitespace stays outside the label; the rest of the run follows it.
      const leading = text.data.length - text.data.trimStart().length;
      const labelText = leading ? text.splitText(leading) : text;
      labelText.splitText(colon - leading + 1);
      const strong = doc.createElement('strong');
      labelText.replaceWith(strong);
      strong.appendChild(labelText);
      return;
    }

    // A leading bold label followed by its colon: move the colon inside.
    const strong = text.previousSibling;
    if (
      text.data.slice(0, colon).trim() ||
      strong?.nodeType !== Node.ELEMENT_NODE ||
      !(strong as Element).matches('strong, b') ||
      label.before.trim() !== strong.textContent?.trim()
    ) return;
    text.deleteData(0, colon + 1);
    const last = strong.lastChild;
    if (last?.nodeType === Node.TEXT_NODE) {
      last.textContent = (last.textContent || '').trimEnd() + ':';
    } else {
      strong.appendChild(doc.createTextNode(':'));
    }
  });
}

export interface ListNormalizeOptions {
  /**
   * First pass only: lists that become adjacent later, because a mode step
   * removed what separated them (the article title), are separate lists in
   * the source and must stay apart.
   */
  mergeLists?: boolean;
  /** Blogs and Shoppables: bold unbolded list labels (boldListLabels). */
  boldLabels?: boolean;
}

export function normalizeLists(html: string, { mergeLists = true, boldLabels = false }: ListNormalizeOptions = {}): string {
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
    
    if (boldLabels) boldListLabels(doc);

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
