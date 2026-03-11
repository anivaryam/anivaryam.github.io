/**
 * Mode Utility: Remove Links in Sources
 * Removes anchor tags from Sources section while keeping content
 * Works with both Blogs and Shoppables modes
 */

export function removeSourcesLinks(html: string): string {
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
      
      // Check if this is a Sources paragraph (matches "sources" or "sources:" or "Sources: ...")
      if (lowerText === 'sources' || lowerText === 'sources:' || lowerText.startsWith('sources:')) {
        // Remove links in the Sources paragraph itself
        removeLinksFromElement(p);
        
        // Find the next ol after Sources paragraph
        let nextSibling = p.nextElementSibling;
        while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
          nextSibling = nextSibling.nextElementSibling;
        }
        
        // Remove links from all list items in the Sources ol
        if (nextSibling && nextSibling.tagName.toLowerCase() === 'ol') {
          const listItems = nextSibling.querySelectorAll('li');
          listItems.forEach(li => {
            removeLinksFromElement(li);
          });
        }
      }
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
