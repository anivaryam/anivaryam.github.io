/**
 * Mode Utility: Sources Normalization
 * Normalizes Sources section formatting for Blogs and Shoppables modes
 */

import { normalizeSectionLabel } from './mode-disclaimer-normalize';
import { wrapInlineContent } from './html-sanitizer';

export function normalizeSources(html: string, sourcesItalic: boolean = true): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const paragraphs = doc.querySelectorAll('p');
    
    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      const lowerText = text.toLowerCase();
      
      if (lowerText === 'sources' || lowerText === 'sources:' || lowerText.startsWith('sources:')) {
        normalizeSectionLabel(p, doc, 'Sources:', /^\s*Sources\s*:?/i);
        
        let nextSibling = p.nextElementSibling;
        while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
          nextSibling = nextSibling.nextElementSibling;
        }
        
        if (nextSibling && nextSibling.tagName.toLowerCase() === 'ol') {
          normalizeSourcesListItems(nextSibling, doc, sourcesItalic);
        }
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Sources normalization failed:', e);
    return html;
  }
}

function normalizeSourcesListItems(olElement: Element, doc: Document, sourcesItalic: boolean = true): void {
  if (!olElement || !doc) return;
  
  const listItems = olElement.querySelectorAll('li');
  
  listItems.forEach(li => {
    // Flatten emphasis belonging to this item before adding one canonical
    // wrapper per inline run. Nested lists retain their own item formatting.
    for (const em of Array.from(li.querySelectorAll('em')).reverse()) {
      if (em.closest('li') === li) em.replaceWith(...Array.from(em.childNodes));
    }
    wrapInlineContent(li, 'em');

    // Add italic style to li when sourcesItalic is enabled
    if (sourcesItalic) {
      li.setAttribute('style', 'font-style: italic');
    } else {
      li.removeAttribute('style');
    }
  });
}
