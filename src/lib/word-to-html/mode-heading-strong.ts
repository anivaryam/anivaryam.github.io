/**
 * Mode Utility: Heading Strong Tags
 * Wraps all heading content in <strong> tags for Blogs and Shoppables modes
 */

export function wrapHeadingsInStrong(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headings.forEach(heading => {
      // First, unwrap any existing strong tags to avoid double-wrapping.
      // Word often splits bold text into several runs, so unwrap all of them.
      unwrapStrongTags(heading);
      
      const childNodes = Array.from(heading.childNodes);
      
      if (childNodes.length === 0) {
        return;
      }
      
      // Check if all content is already in a single strong tag
      if (childNodes.length === 1 && 
          childNodes[0].nodeType === Node.ELEMENT_NODE && 
          (childNodes[0] as Element).tagName.toLowerCase() === 'strong') {
        return; // Already wrapped
      }
      
      const strong = doc.createElement('strong');
      
      childNodes.forEach(node => {
        strong.appendChild(node.cloneNode(true));
      });
      
      heading.innerHTML = '';
      heading.appendChild(strong);
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Heading strong tag wrapping failed:', e);
    return html;
  }
}

/**
 * Remove strong tags from headings (for when feature is disabled)
 */
export function unwrapHeadingsFromStrong(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headings.forEach(unwrapStrongTags);
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Heading strong tag unwrapping failed:', e);
    return html;
  }
}

/** Unwrap every <strong> inside the heading, keeping its content in place. */
function unwrapStrongTags(heading: Element): void {
  heading.querySelectorAll('strong').forEach(strong => {
    strong.replaceWith(...Array.from(strong.childNodes));
  });
}
