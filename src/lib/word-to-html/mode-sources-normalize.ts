/**
 * Mode Utility: Sources Normalization
 * Normalizes Sources section formatting for Blogs and Shoppables modes
 */

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
        normalizeSourcesParagraph(p, doc);
        
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

function normalizeSourcesParagraph(paragraph: Element, doc: Document): void {
  if (!paragraph) return;
  
  paragraph.innerHTML = '';
  
  const strong = doc.createElement('strong');
  const em = doc.createElement('em');
  em.textContent = 'Sources:';
  
  strong.appendChild(em);
  paragraph.appendChild(strong);
}

function normalizeSourcesListItems(olElement: Element, doc: Document, sourcesItalic: boolean = true): void {
  if (!olElement || !doc) return;
  
  const listItems = olElement.querySelectorAll('li');
  
  listItems.forEach(li => {
    // Skip if already wrapped in EM without any text outside
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
    
    // Skip if already has EM - preserve existing formatting (bold, EM, etc.)
    if (li.querySelector('em')) {
      return;
    }
    
    // Only wrap text nodes in EM if there's no existing EM wrapper
    const textNodes: Node[] = [];
    const otherNodes: Node[] = [];
    
    li.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE && (child as Text).textContent?.trim()) {
        textNodes.push(child);
      } else {
        otherNodes.push(child);
      }
    });
    
    if (textNodes.length > 0 && otherNodes.length === 0) {
      // Only plain text, safe to wrap in EM
      const em = doc.createElement('em');
      textNodes.forEach(node => em.appendChild(node));
      li.appendChild(em);
    }
    // If there are other elements (strong, em, etc.), preserve them as-is

    // Add italic style to li when sourcesItalic is enabled
    if (sourcesItalic) {
      li.setAttribute('style', 'font-style: italic');
    }
  });
}

