/**
 * Mode Utility: Remove Links in Sources
 * Removes anchor tags from Sources section while keeping content
 * Works with both Blogs and Shoppables modes
 */

import { findSourcesSections } from './mode-sources-section';

export function removeSourcesLinks(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    findSourcesSections(doc).forEach(({ label, list }) => {
      removeLinksFromElement(label);
      if (list) removeLinksFromElement(list);
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Remove sources links failed:', e);
    return html;
  }
}

/**
 * Removes all anchor tags from an element while keeping their content
 */
function removeLinksFromElement(element: Element): void {
  if (!element) return;
  
  const links = element.querySelectorAll('a');
  
  links.forEach(anchor => {
    // Get all child nodes from the anchor
    const childNodes = Array.from(anchor.childNodes);
    
    // Insert each child node before the anchor
    childNodes.forEach(child => {
      anchor.parentNode?.insertBefore(child, anchor);
    });
    
    // Remove the empty anchor tag
    anchor.remove();
  });
}
