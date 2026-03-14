/**
 * Mode Utility: OL Header Conversion
 * Converts single <ol> elements containing headers into manually numbered headers
 * 
 * Rules:
 * - Lists must be fully header-only; mixed lists (containing both headers and regular content) are ignored
 * - Preserves original heading levels (h1-h6) - does not normalize to a single level
 * - Numbering resets per <h2> section and stops at <h1> boundaries
 * - Supports both Word-style structures: <li><strong><hX>...</hX></strong></li> and <li><hX><strong>...</strong></hX></li>
 * - Non-heading content inside list items is discarded (only headings are extracted and numbered)
 */

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

  // Ensure no text nodes (only the heading element)
  const textNodes = Array.from(strongTag.childNodes).filter(
    node => node.nodeType === 3 && (node as Text).textContent?.trim() !== ''
  );
  
  return textNodes.length === 0;
}

/**
 * Checks if a list item has a heading directly containing a <strong> tag
 * Example: <li><h3><strong>Title</strong></h3></li>
 * Note: querySelector will find headings even if there are empty <p> tags before them
 */
function hasDirectStrongHeading(li: Element): boolean {
  const directHeading = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
  if (!directHeading) {
    return false;
  }
  
  const strongInHeading = directHeading.querySelector(':scope > strong');
  return strongInHeading !== null;
}

function isHeaderList(olElement: Element): boolean {
  const listItems = olElement.querySelectorAll(':scope > li');
  
  if (listItems.length === 0) {
    return false;
  }

  // All list items must be valid headers; mixed lists are rejected
  for (const li of listItems) {
    if (!hasStrongWrappedHeading(li) && !hasDirectStrongHeading(li)) {
      return false;
    }
  }

  return true;
}

function isFollowedByHeaderList(element: Element): boolean {
  let nextSibling = element.nextElementSibling;
  
  while (nextSibling) {
    if (nextSibling.tagName.toLowerCase() === 'p') {
      const text = nextSibling.textContent?.trim() || '';
      // textContent returns decoded \u00A0, not the entity string '&nbsp;'
      if (text === '' || text === '\u00A0') {
        nextSibling = nextSibling.nextElementSibling;
        continue;
      }
    }
    
    if (nextSibling.tagName.toLowerCase() === 'ol' && isHeaderList(nextSibling)) {
      return true;
    }
    
    break;
  }
  
  return false;
}

export function convertOlHeaders(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const olElements = Array.from(doc.querySelectorAll('ol'));
    const olsToProcess: Element[] = [];

    olElements.forEach(ol => {
      if (isHeaderList(ol) && !isFollowedByHeaderList(ol)) {
        olsToProcess.push(ol);
      }
    });

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
          const originalText = innerStrong.textContent?.trim() || '';
          innerStrong.textContent = `${counter}. ${originalText}`;
        } else {
          const headingText = newHeading.textContent?.trim() || '';
          newHeading.textContent = `${counter}. ${headingText}`;
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

