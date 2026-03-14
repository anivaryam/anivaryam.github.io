/**
 * Mode Utility: Sources Normalization
 * Normalizes Sources section formatting for Blogs and Shoppables modes
 */

export function normalizeSources(html: string): string {
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
      
      if (lowerText === 'sources' || lowerText === 'sources:') {
        normalizeSourcesParagraph(p, doc);
        
        let nextSibling = p.nextElementSibling;
        while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
          nextSibling = nextSibling.nextElementSibling;
        }
        
        if (nextSibling && nextSibling.tagName.toLowerCase() === 'ol') {
          normalizeSourcesListItems(nextSibling, doc);
        }
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Sources normalization failed:', e);
    return html;
  }
}

function normalizeSourcesParagraph(paragraph: Element, doc: Document): void {
  if (!paragraph) return;
  
  paragraph.innerHTML = '';
  
  const strong = doc.createElement('strong');
  const em = doc.createElement('em');
  em.textContent = 'Sources:';
  
  strong.appendChild(em);
  paragraph.appendChild(strong);
}

function normalizeSourcesListItems(olElement: Element, doc: Document): void {
  if (!olElement || !doc) return;
  
  const listItems = olElement.querySelectorAll('li');
  
  listItems.forEach(li => {
    if (li.children.length === 1 && li.children[0].tagName.toLowerCase() === 'em') {
      const hasTextOutside = Array.from(li.childNodes).some(node => 
        node.nodeType === Node.TEXT_NODE && 
        node.parentNode === li && 
        (node as Text).textContent?.trim()
      );
      if (!hasTextOutside) {
        return;
      }
    }
    
    const children = Array.from(li.childNodes);
    li.innerHTML = '';
    
    const em = doc.createElement('em');
    children.forEach(child => {
      em.appendChild(child);
    });
    
    li.appendChild(em);
  });
}

