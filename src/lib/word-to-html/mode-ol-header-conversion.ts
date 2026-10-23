/**
 * Mode Utility: OL Header Conversion
 * Converts single <ol> elements containing headers into manually numbered headers
 * 
 * Rules:
 * - Lists must be fully header-only; mixed lists (containing both headers and regular content) are ignored
 * - Preserves original heading levels (h1-h6) - does not normalize to a single level
 * - Numbering resets per <h2> section and stops at <h1> boundaries; adjacent header lists continue it
 * - Supports both Word-style structures: <li><strong><hX>...</hX></strong></li> and <li><hX>...</hX></li>,
 *   with or without <strong> inside the heading (Heading Strong runs first and may have unwrapped it)
 * - An item with anything besides its heading (body text, a second heading, a nested list) makes the
 *   list mixed; only blank Word filler (empty paragraphs, line breaks) next to the heading is discarded
 */

/**
 * Blank Word filler (whitespace, empty paragraphs, line breaks) that the
 * conversion can drop without losing content. Shared with the table to list
 * conversion, which drops the same filler from table cells.
 */
export function isBlankNode(node: Node): boolean {
  if (node.nodeType === Node.COMMENT_NODE) return true;
  if ((node.textContent || '').trim()) return false;
  if (node.nodeType !== Node.ELEMENT_NODE) return true;
  const element = node as Element;
  return !element.matches('img, hr') && !element.querySelector('img, hr');
}

/** True when `container` holds nothing but `content` and blank filler */
function holdsOnly(container: Element, content: Element): boolean {
  return Array.from(container.childNodes).every(node => node === content || isBlankNode(node));
}

/**
 * Checks if a list item has a <strong> tag wrapping a heading (Word-style structure)
 * Example: <li><strong><h3>Title</h3></strong></li>
 */
function hasStrongWrappedHeading(li: Element): boolean {
  const strongTag = li.querySelector(':scope > strong');
  if (!strongTag) {
    return false;
  }

  const headingChildren = Array.from(strongTag.children).filter(
    node => /^h[1-6]$/i.test((node as Element).tagName)
  );
  
  if (headingChildren.length !== 1) {
    return false;
  }

  // Only the heading is kept, so the item must hold nothing else
  return holdsOnly(strongTag, headingChildren[0]) && holdsOnly(li, strongTag);
}

/**
 * Checks if a list item holds a heading directly
 * Example: <li><h3><strong>Title</strong></h3></li> or <li><h3>Title</h3></li>
 * Bold is not required: with Heading Strong off, its <strong> is already unwrapped.
 * Note: querySelector will find headings even if there are empty <p> tags before them
 */
function hasDirectHeading(li: Element): boolean {
  const directHeading = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
  return directHeading !== null && holdsOnly(li, directHeading);
}

/** Shared with the validator and the UI warnings so all three flag the same lists */
export function isHeaderList(olElement: Element): boolean {
  const listItems = olElement.querySelectorAll(':scope > li');
  
  if (listItems.length === 0) {
    return false;
  }

  // All list items must be valid headers; mixed lists are rejected
  for (const li of listItems) {
    if (!hasStrongWrappedHeading(li) && !hasDirectHeading(li)) {
      return false;
    }
  }

  return true;
}

export function convertOlHeaders(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Chained header lists (Word Online emits one <ol> per item) all convert;
    // the shared section counter keeps their numbering continuous.
    const olsToProcess = Array.from(doc.querySelectorAll('ol')).filter(isHeaderList);

    const bodyChildren = Array.from(doc.body.children);
    const sectionCounters = new Map<Element | null, number>();
    
    olsToProcess.forEach(ol => {
      const olIndex = bodyChildren.indexOf(ol);
      
      let parentH2: Element | null = null;
      for (let i = olIndex - 1; i >= 0; i--) {
        const element = bodyChildren[i];
        if (!element) continue;
        
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'h2') {
          parentH2 = element;
          break;
        }
        if (tagName === 'h1') {
          break;
        }
      }
      
      // null represents "before first h2 or under h1" - used as section key for top-level numbering
      const sectionKey = parentH2 || null;
      if (!sectionCounters.has(sectionKey)) {
        sectionCounters.set(sectionKey, 1);
      }
      
      let counter = sectionCounters.get(sectionKey)!;
      
      const listItems = ol.querySelectorAll(':scope > li');
      const newElements: Element[] = [];

      listItems.forEach((li) => {
        // Find the heading - it could be in a <strong> tag or directly in the <li>
        let heading: Element | null = null;
        let strongTag: Element | null = null;
        
        // First, try to find a heading directly in the <li> (new structure)
        const directHeading = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
        if (directHeading) {
          heading = directHeading as Element;
          strongTag = heading.querySelector(':scope > strong');
        } else {
          // Fall back to the original logic: <strong> containing a heading
          strongTag = li.querySelector(':scope > strong');
          if (strongTag) {
            heading = strongTag.querySelector('h1, h2, h3, h4, h5, h6') as Element | null;
          }
        }
        
        // Defensive: should be impossible due to isHeaderList validation, but protects against edge cases
        if (!heading) return;

        // Clone the heading to preserve its original level (h1-h6) and structure
        const newHeading = heading.cloneNode(true) as Element;
        
        const innerStrong = newHeading.querySelector(':scope > strong');
        
        if (innerStrong) {
          innerStrong.prepend(doc.createTextNode(`${counter}. `));
        } else {
          newHeading.prepend(doc.createTextNode(`${counter}. `));
        }
        
        // Increment counter for next item
        counter++;
        sectionCounters.set(sectionKey, counter);
        
        newElements.push(newHeading);
      });

      if (newElements.length > 0) {
        // Safety guard: ensure ol is still in the DOM (should always be true given doc.body)
        if (!ol.parentNode) {
          return; // Skip this ol if it's been removed from DOM
        }
        
        newElements.forEach((heading, index) => {
          if (index === 0) {
            ol.parentNode!.insertBefore(heading, ol);
          } else {
            const previousHeading = newElements[index - 1];
            previousHeading.parentNode!.insertBefore(heading, previousHeading.nextSibling);
          }
        });
        
        ol.remove();
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('OL header conversion failed:', e);
    return html;
  }
}
