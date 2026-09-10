/**
 * Mode Utility: Sources Normalization
 * Normalizes Sources section formatting for Blogs and Shoppables modes
 */

import { normalizeSectionLabel } from './mode-disclaimer-normalize';

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
    const alreadyWrapped = li.childNodes.length === 1 && li.firstElementChild?.tagName.toLowerCase() === 'em';
    if (!alreadyWrapped) {
      // Move every node in order, including bold text and nested formatting.
      const em = doc.createElement('em');
      while (li.firstChild) {
        em.appendChild(li.firstChild);
      }
      li.appendChild(em);
    }

    // Add italic style to li when sourcesItalic is enabled
    if (sourcesItalic) {
      li.setAttribute('style', 'font-style: italic');
    } else {
      li.removeAttribute('style');
    }
  });
}
